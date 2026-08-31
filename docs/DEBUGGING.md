# Debugging — MercadoTech

Guía para cuando algo falla y hay un error en pantalla. Cada entrada de la
tabla lleva el mensaje LITERAL como título — buscá el tuyo con Ctrl+F antes
de leer el resto.

## El flujo (siempre en este orden)

1. **Síntoma.** Anotá el mensaje EXACTO (copiar/pegar, no de memoria) y
   dónde apareció: ¿terminal de `npm run dev`? ¿consola del navegador?
   ¿`npm run test`? ¿la pestaña Actions de GitHub?

2. **Reproducir.** La mejor reproducción es **un test que falla** — si el
   síntoma no tiene un test que lo capture, ese es el primer paso, no un
   atajo: escribilo (unitario si es lógica pura/un `service`, E2E si es un
   flujo completo de UI). Un bug sin test que lo reproduzca vuelve a pasar.

3. **Leer los logs correctos**, según dónde vive el síntoma:

   | Dónde falla | Qué mirar |
   |---|---|
   | Página del navegador | Consola del navegador (`F12`) + la pestaña Network para ver el status code real de la request |
   | Un `service`/hook en `npm run dev` | La terminal donde corre `npm run dev` — Next imprime el stack del servidor ahí, no en el navegador |
   | El endpoint de chat (`/api/v1/chat`) | El log estructurado que ya emite la ruta: `retrievedCount/usedSourceCount/hasRelevantContext/contextTruncated` (Fase 4.6) — dice si el problema es "no encontró nada" vs. "encontró pero el modelo no respondió" |
   | La base de datos | `supabase logs` (o Studio → Logs, `http://127.0.0.1:54323`) — necesario para ver el `RAISE EXCEPTION` real de una función `SECURITY DEFINER` como `create_order_from_cart`, que Postgres no siempre repite igual hacia PostgREST |
   | El servidor MCP | Nunca imprime nada por stdout (ver la tabla de abajo) — usa stderr, visible en `npm run dev` dentro de `mcp/` o en el log del cliente MCP (Claude Desktop: pestaña "Code" → el servidor) |
   | GitHub Actions (CI) | Ver "Cómo leer un fallo de CI" más abajo — no asumas la causa por el nombre del job, abrí el log del step que falló |

4. **Una sola hipótesis.** Con el mensaje literal y el log real en mano,
   escribí en una línea qué creés que pasa — y por qué el mensaje apunta
   ahí. Si tenés dos hipótesis, elegí la más simple y probala primero; no
   cambies dos cosas a la vez.

5. **Fix.** Cambiá SOLO lo que la hipótesis señala.

6. **El test pasa.** Si no escribiste uno en el paso 2, este es el momento
   de agregarlo — un fix sin test que lo cubra es un fix que puede
   desaparecer en el próximo refactor sin que nadie lo note.

## Cómo pedirle debugging a Claude

Cuanto más completo el contexto, menos vueltas. Dale, en este orden:

1. **El síntoma exacto** — el mensaje literal, copiado, no resumido.
2. **Los pasos para reproducirlo** — qué usuario, qué pantalla, qué acción.
   "No funciona el checkout" obliga a adivinar; "buyer1 agrega 2 unidades
   de un producto con stock 8 y hace clic en Finalizar compra" no.
3. **El log real**, pegado tal cual (terminal, consola del navegador, o el
   job de Actions) — no una paráfrasis de lo que dice.
4. **Qué ya se descartó.** Si ya probaste algo y no era eso, decilo — evita
   que la primera sugerencia sea justo lo que ya probaste.

Con esos cuatro datos, Claude puede reproducir la hipótesis en vez de
adivinar a ciegas — igual que un humano de guardia.

## Cómo leer un fallo de CI

1. En la pestaña **Actions** del repo, abrí la corrida en rojo.
2. Fijate **cuál de los dos jobs** falló: `checks` (rápido, sin Docker —
   type-check/lint/tests unitarios/type-check de `mcp/`) o `e2e` (Supabase
   efímero + Playwright). El nombre del job ya acota mucho la búsqueda.
3. Abrí el **step** que tiene la ✗ roja — el mensaje real está ahí, no hay
   que adivinar por el nombre del job.
4. Si fue `e2e` y el step `E2E (Chromium)` falló, bajá al final de la
   corrida: si hay un artefacto `playwright-report` (solo se sube
   `if: failure()`, retención 14 días), descargalo:
   ```bash
   gh run download <run-id> -n playwright-report -D /tmp/reporte-ci
   ```
   Adentro, `index.html` es el reporte completo (abrilo en el navegador);
   si necesitás el detalle paso a paso de qué vio la página en el momento
   exacto del fallo, `data/*.md` tiene el snapshot en texto y `data/*.png`
   la captura — no hace falta reproducir en Actions de nuevo para leerlos.
5. El job `checks` siempre sube `coverage/` como artefacto
   (`if: always()`, 7 días) — sirve para confirmar cobertura real incluso
   en una corrida verde, no solo para diagnosticar una roja.
6. **CI verde en local, rojo solo en Actions:** el sospechoso #1 es
   dev vs. build de producción — `playwright.config.ts` hace
   `npm run build && npm run start` en CI (nunca `npm run dev`). Reproducí
   local con la misma variable:
   ```bash
   CI=true npm run test:e2e -- --project=chromium
   ```
   Si con eso el fallo NO reproduce local, el diferencial es específico del
   runner (hardware/timing) — no sigas ajustando a ciegas: buscá una señal
   de la propia app en vez de reconstruir cómo mide temporizaciones un
   entorno que no podés inspeccionar directo (ejemplo real de la Fase 6.7,
   ver la tabla de abajo, fila del drag por teclado).

## Errores típicos del stack

Mensaje literal como título — buscá el tuyo. Fuente de cada fila citada
donde aplica; ninguna tabla de otro documento se duplica acá, solo se
referencia.

### `permission denied for table «tabla»` (o `for function «función»`)

**Causa:** falta un `GRANT` de Postgres. `BYPASSRLS` (el atributo del rol
`service_role`) NO sustituye los `GRANT` de tabla/función — son dos
mecanismos independientes (hallazgo real, Fase 4.3: el cliente admin podía
saltarse RLS pero igual necesitaba `grant select` explícito sobre
`products`/`categories`/`support_articles`; se repitió en la Fase 5.4 con
la función `match_knowledge`, que necesitaba su propio `grant execute`).

**Primer paso:**
```sql
-- en supabase/migrations/, una migración nueva:
grant select on public.mi_tabla to service_role;
-- o, para una función SECURITY INVOKER/DEFINER:
grant execute on function public.mi_funcion(...) to service_role;
```

### 0 filas donde esperabas datos (sin ningún error)

**Causa:** RLS filtrando en silencio. Una política de `SELECT` que no
matchea no lanza excepción — simplemente no devuelve la fila, como si no
existiera (ejemplo real, Fase 3.6: un comprador abriendo por URL directa
el pedido de otro comprador ve `ErrorState`, no un 404 explícito, porque
`single()` sobre cero filas es un error de PostgREST, pero la ausencia en
sí la causa RLS, no la app).

**Primer paso:** confirmá con el cliente ADMIN (que sí bypassea RLS) si la
fila existe de verdad. Si existe con admin pero no con el cliente normal,
es una política — revisá `supabase/policies.sql` contra qué usuario/rol
estás probando.

### `new row violates row-level security policy for table «tabla»`

**Causa:** un `INSERT`/`UPDATE` que sí dispara un error explícito (a
diferencia del `SELECT` silencioso de arriba) — el `WITH CHECK` de la
política rechazó la fila. Es la contraparte "con error" del síntoma
anterior: pasa en `INSERT`/`UPDATE`, no en `SELECT`.

**Primer paso:** revisá el `WITH CHECK` de la política de esa tabla/
operación contra el valor real que estás mandando (`auth.uid()` vs. el
`user_id`/`buyer_id`/`seller_id` de la fila).

### `Token de Hugging Face inválido o expirado (401)`

**Causa:** cubierta en detalle, con toda la tabla de síntomas de IA
(401/429/"model not supported"/embeddings vs. chat), en
[`docs/RAG.md` § "Si algo falla"](RAG.md#si-algo-falla-síntomas-y-diagnóstico)
— no se duplica acá.

### `Embedding con dimensión inesperada: se esperaban 384, llegaron «N»`

**Causa:** el modelo de embeddings configurado en
`HUGGINGFACE_EMBEDDING_MODEL` no es
`sentence-transformers/all-MiniLM-L6-v2` (o un modelo con la misma
dimensión de salida). La columna `knowledge_embeddings.embedding` está
tipada `vector(384)` en la base — cambiar de modelo a uno con otra
dimensión exige una migración (`ALTER COLUMN ... TYPE vector(N)` + recrear
el índice HNSW y la función `match_knowledge`), no alcanza con cambiar la
variable de entorno.

**Primer paso:** revertí `HUGGINGFACE_EMBEDDING_MODEL` al modelo por
defecto, o confirmá la dimensión real del modelo nuevo antes de tocar
nada más.

### `npm ci` falla con `Missing: «paquete»@«versión» from lock file`

**Causa:** el `npm` del runner es distinto al que generó
`package-lock.json` — una versión de npm distinta puede resolver
dependencias OPCIONALES específicas de plataforma diferente al recalcular
el árbol, y `npm ci` rechaza el lockfile aunque sea válido para la versión
que lo generó (decisión 10 de la Sesión 6; lección de ReadHub). **Nota:**
la versión real que generó el lockfile de este repo es `npm@10.8.2`
(verificado con `npm --version` antes de escribir el pin — no `11.6.2`,
que es lo que una versión anterior de esta guía asumía sin comprobar).

**Primer paso:**
```bash
npm install -g npm@10.8.2   # exactamente lo que fija .github/workflows/ci.yml
npm ci
```
Si el lockfile cambió de verdad (una dependencia nueva), regenéralo con
esa misma versión de npm, no con la que tengas instalada localmente por
defecto.

### El servidor MCP no responde / el cliente MCP no puede parsear nada

**Causa:** algo escribió por **stdout** además del propio JSON-RPC del
protocolo. El transporte stdio de MCP asume que CADA línea de stdout es un
mensaje JSON-RPC completo — un `console.log` (o cualquier salida de una
librería que no controlás) corrompe el stream y el cliente falla al
parsear silenciosamente, sin un mensaje de error claro de este lado.
Prevenido desde el arranque del servidor (Fase 5.2): `mcp/src/index.ts`
redirige `console.log/info/warn` a **stderr** como el primer `import` del
archivo (los imports se evalúan antes que cualquier statement propio del
módulo que los declara en ESM — ponerlo como la "primera línea de código"
en cambio no alcanza).

**Primer paso:** corré el servidor directo por stdio y confirmá que stdout
queda limpio:
```bash
cd mercadotech && npx tsx mcp/src/index.ts < /dev/null
# no debe imprimir NADA salvo que el propio protocolo MCP responda algo
```
Si algo aparece ahí, es la fuente de la corrupción — mandalo a stderr.

### El drag del kanban no se mueve en Playwright (o solo falla en CI)

**Causa real, Fase 6.6/6.7:** el `KeyboardSensor` de dnd-kit, sin un
`coordinateGetter` propio, mueve el cursor virtual **25px por pulsación**
de flecha — no "una columna por pulsación". Además, `rectIntersection`
(la detección de colisión por defecto) compara ÁREA de solapamiento, no
un punto: el centro de la tarjeta cruzando a la columna vecina no basta,
tiene que estar mayormente adentro. Reconstruir esa geometría a mano
(medir `boundingBox()` propio) funcionó en local pero falló de forma
consistente en el runner real de GitHub Actions (confirmado descargando
el trace del run fallido — las pulsaciones sí llegaban, la medición
propia nunca detectaba el cruce ahí). Fix real: en vez de reconstruir la
geometría, pollear la región `role="status" aria-live="assertive"` que
`@dnd-kit/accessibility` ya expone con sus propios anuncios de colisión
("...was moved over droppable area «id».") — es la fuente de verdad de la
librería, no una reconstrucción.

**Primer paso:** si el drag por teclado "no ocurre" en absoluto (no solo
mide mal cuántas columnas cruzó), lo primero es descartar que se haya
intentado con mouse (`mouse.down/move/up`) en vez del camino de teclado
real: `focus()` en el asa → `Space` (levanta) → flecha (mueve) → `Space`
(suelta) — ver `e2e/pages/SellerKanbanPage.ts`.

### Playwright: timeout esperando el `webServer`

**Causa:** `next build` lento, o el puerto 3000 ya ocupado por otro
proceso (`npm run dev` corriendo en otra terminal, por ejemplo).

**Primer paso:**
```bash
lsof -i :3000        # ¿hay algo ya escuchando ahí?
```
Si no, subí `webServer.timeout` en `playwright.config.ts`; si sí, matalo o
usá otro puerto.

### E2E rojos con "0 rows" o login fallido, pero el código no cambió

**Causa:** datos sucios de una corrida anterior — un E2E que compra algo
descuenta stock de verdad y vacía el carrito; uno que mueve un pedido del
kanban lo deja en el estado nuevo. La suite espera el seed limpio.

**Primer paso:**
```bash
supabase db reset
```
Es parte del contrato de los E2E, no un parche — correrlo antes de CADA
suite completa, según la Fase 6.5/6.6/6.7 lo documentan.

### Un test unitario pasa solo, pero falla si Docker está apagado

**Causa:** el mock inyectado no cubre alguna llamada de ese test, y el
`createClient()` real (el default del parámetro `supabase`) se coló sin
que nadie lo mande explícito — el test "pasa" porque hay un Supabase local
real respondiendo detrás, no porque el mock esté completo.

**Primer paso:**
```bash
supabase stop
npm run test    # si algo falla acá que no fallaba antes, ahí está el hueco
```
Es la forma real de cazarlos — la Fase 6.3 corre así por diseño.

---

Tabla adaptada de la sección "Si algo falla" de
[`MercadoTech_sesion6.md`](../MercadoTech_sesion6.md#si-algo-falla-síntomas-y-diagnóstico),
con los valores reales de este repo donde la spec asumía distinto (el pin
de npm) y las filas ampliadas con el detalle de causa real encontrado
durante la Sesión 6 (drag del kanban, GRANT, stdout del MCP).
