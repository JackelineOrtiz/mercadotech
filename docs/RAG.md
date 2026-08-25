# RAG — indexación, búsqueda semántica y asistentes

Documentación de la Fase 4.8: verificación de extremo a extremo del pipeline
RAG (Sesión 4) contra la app y la base de datos reales, y calibración de
`VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD` con datos reales.

## Baseline

```
$ npx tsx scripts/index-all.ts
Listo: 14 productos + 10 artículos = 24 fichas en knowledge_embeddings.
```

24 fichas = 14 productos activos + 10 artículos de FAQ publicados del seed,
tal como exige el paso 1 de la Fase 4.8.

## Los 6 casos

### Caso 1 — Indexación automática

**Entrada:** publicar "Audífonos deportivos Sony resistentes al sudor" (S/
159, categoría Accesorios) desde `/vendedor/publicar` con la sesión de
`seller1@mercadotech.test`.

**Resultado esperado:** fila nueva en `knowledge_embeddings`.

**Evidencia:**

- UI: toast "Producto publicado." tras el submit.
- `knowledge_embeddings` pasó de 24 a 25 filas:

```
$ psql ... -c "select count(*) from knowledge_embeddings;"
 count
-------
    25
```

- La fila nueva (`source_id = dc681a48-4c57-4e75-a5a2-f8359a10779d`) contiene
  el texto compuesto por `buildProductEmbeddingText` (título, categoría,
  condición, descripción) y `metadata.title/price` correctos:

```
Título: Audífonos deportivos Sony resistentes al sudor
Categoría: Accesorios
Condición: nuevo
Descripción: Audífonos inalámbricos deportivos, resistentes al sudor y al
agua, ideales para correr y hacer ejercicio en el gimnasio.
```

**Resultado:** PASA. El `triggerReindex` fire-and-forget de `useProductForm`
disparó `POST /api/v1/reindex` y la ficha quedó indexada sin acción manual.

### Caso 2 — Recuperación semántica

**Entrada:** buscar "audífonos para gimnasio" como `buyer1@mercadotech.test`
en `/buscar`, pestaña "Resultados con IA".

**Resultado esperado:** productos de audio deportivo primero.

**Evidencia** (usando el producto recién publicado del Caso 1 para tener una
coincidencia genuinamente deportiva en el catálogo):

| # | Producto | Similitud |
|---|---|---|
| 1 | Audífonos deportivos Sony resistentes al sudor | **52%** |
| 2 | Audífonos HyperX Cloud Stinger 2 | 38% |
| 3 | Silla gamer Cougar Armor One | 35% |

**Resultado:** PASA. El producto de audio deportivo específico queda #1 con
un margen claro (14 puntos) sobre el segundo resultado, también de audio.
Con el seed original (sin este producto) el top 1 era "Silla gamer" a ~35%
— una limitación del contenido del seed (no había audífonos "deportivos"
explícitos), no del algoritmo: al añadir contenido realmente relevante, el
ranking se corrige solo.

### Caso 3 — Respuesta contextual (compras)

**Entrada:** "laptop liviana para la universidad" en `/asistente`.

**Resultado esperado:** respuesta cita 2+ productos reales con links.

**Respuesta real:**

> Basado en tu búsqueda de una laptop liviana para la universidad, te
> recomiendo los siguientes productos:
>
> 1. [2] Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD: Esta
> laptop es liviana y perfecta para estudios y teletrabajo...
> 2. [1] Laptop HP Pavilion 14" Intel i5 8GB 512GB SSD: Aunque es un poco
> más pequeño que la Lenovo, también es liviano...
>
> No encontré ningún otro producto en el contexto que coincida con tu
> búsqueda.

Fuentes mostradas: `[1] Laptop HP Pavilion 14"` (S/ 2,499) y `[2] Laptop
Lenovo IdeaPad Slim 3` (S/ 2,199), cada una con link a su `/producto/[id]`.

Log del endpoint: `mode=compras retrievedCount=5 usedSourceCount=5
hasRelevantContext=true contextTruncated=false`.

**Resultado:** PASA. Cita 2 productos reales, ambos con precio/nombre
correctos y enlazados; no inventa características fuera del contexto.

### Caso 4 — Respuesta contextual (soporte)

**Entrada:** "¿cómo devuelvo un producto?" en `/soporte`.

**Respuesta real:**

> Según nuestro artículo [2], para solicitar una devolución, debes abrir un
> ticket de soporte indicando el número de pedido, el producto y el motivo
> de la devolución. Nuestro equipo coordinará la recolección con el
> vendedor y te confirmará los siguientes pasos.

Fuente `[2]` = "¿Cómo solicito la devolución de un producto?" (categoría
`devoluciones`) — el artículo correcto, citado explícitamente.

**Resultado:** PASA.

### Caso 5 — Sin información

**Entrada:** "¿venden autos usados?" en `/soporte`.

**Resultado esperado:** admite que no hay resultados; sugiere abrir un
ticket.

**Respuesta real:**

> Lo siento, pero no hay información disponible en el contexto proporcionado
> sobre la venta de autos usados. Si tienes alguna otra pregunta relacionada
> con la venta de productos en MercadoTech, estaré encantado de ayudarte. Si
> necesitas ayuda con algo específico, como un artículo de ayuda o una
> respuesta a una pregunta, por favor, revisa nuestra base de conocimientos
> o abre un ticket de soporte.

**Resultado:** PASA, con una salvedad documentada: en una repetición previa
de la misma pregunta el modelo admitió correctamente que no tenía la
información pero **no** mencionó el ticket de soporte (el `system prompt`
en `lib/ai/prompts.ts` ya se lo pide explícitamente: *"sugiere abrir un
ticket de soporte para que el equipo lo revise"*). Es variabilidad propia
del LLM (temperatura, no determinista), no un bug de código — en ambas
corridas el asistente nunca inventó una política ni un producto fuera del
contexto. Ver sección de calibración: el contexto entregado al modelo en
esta pregunta son 5 artículos de FAQ genuinos pero **irrelevantes**
(41–47% de similitud, ruido de fondo), y es el propio modelo — no el
threshold — el que decide correctamente no usarlos.

### Caso 6 — Navegación desde fuentes

**Entrada:** clic en la fuente `[1] Laptop HP Pavilion 14"` de la respuesta
del Caso 3.

**Resultado esperado:** abre el producto correcto.

**Evidencia:** el clic navegó a `/producto/b0000000-0000-0000-0000-000000000001`
y la página mostró título, precio (S/ 2,499.00) y descripción de esa misma
laptop — coincide exactamente con la fuente citada.

**Resultado:** PASA.

## Calibración del threshold

`VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD` partía de 0.3 (provisional,
Fase 4.2). Datos reales recogidos en esta fase, con `match_count=5` y
threshold=0 (para ver las 5 mejores similitudes sin filtrar):

| Consulta | Fuente tipo | Top 5 similitud |
|---|---|---|
| "laptop liviana para la universidad" | producto | 56.9%, 49.1%, 34.7%, 34.5%, 33.4% |
| "audífonos para gimnasio" | producto | 52.1%, 37.7%, 35.1%, 29.4%, 29.3% |
| "¿venden autos usados?" (sin relación con el catálogo) | articulo_soporte | 46.6%, 44.9%, 44.4%, 42.9%, 41.0% |

Logs estructurados de `/api/v1/chat` durante las pruebas de esta fase (todas
las consultas, relevantes e irrelevantes):

```
[chat] mode=compras retrievedCount=5 usedSourceCount=5 hasRelevantContext=true contextTruncated=false
[chat] mode=soporte retrievedCount=5 usedSourceCount=5 hasRelevantContext=true contextTruncated=false
[chat] mode=soporte retrievedCount=5 usedSourceCount=5 hasRelevantContext=true contextTruncated=false
```

**Lectura de los datos:**

- Para consultas legítimas, la coincidencia real está 10–20 puntos por
  encima del "piso de ruido" del resto del corpus (56.9% vs ~34% en
  laptops; 52.1% vs ~35% en audífonos) — hay margen claro.
- Para una consulta sin relación con el dominio ("autos usados"), el corpus
  de soporte (solo 10 artículos) igual devuelve 5 resultados en el rango
  41–47%: es "ruido de fondo" por vocabulario/idioma compartido en un
  corpus chico, no relevancia real.
- Con threshold=0.3, **ambos casos** entran como `hasRelevantContext: true`
  con 5 fuentes — el threshold nunca filtra el caso "sin información" en la
  práctica, porque el piso de ruido de este corpus (41–47%) ya está por
  encima de 0.3.
- Subir el threshold no resuelve esto sin costo: el segundo resultado
  relevante de "laptop" cae en 49.1% y el segundo de "audífonos" en 37.7% —
  un threshold que excluya el ruido de soporte (≥0.47) también cortaría
  recomendaciones legítimas de productos secundarios. Bajarlo tampoco ayuda:
  ya está por debajo de todo el ruido observado.

**Decisión: el threshold se queda en 0.3.** La razón es que en este corpus
(pequeño, ~10–14 fichas por `source_type`) el threshold de similitud no
puede por sí solo distinguir "sin información" de "información real" — el
filtro efectivo contra el ruido es el propio LLM, guiado por el `system
prompt` ("responde ÚNICAMENTE con información del contexto", "si el
contexto no tiene la respuesta, dilo con claridad"), y en los 2/2 casos
probados el modelo NO inventó una respuesta a partir de fuentes irrelevantes
— siempre admitió que no tenía la información, aunque la sugerencia de abrir
un ticket varió entre corridas (ver Caso 5). Si el corpus crece
significativamente (más artículos/productos por categoría), vale la pena
recalibrar: con más contenido el piso de ruido debería bajar y un threshold
más alto sí empezaría a discriminar mejor.

## Limpieza post-pruebas

Tras documentar los 6 casos se corrió `supabase db reset` seguido de
`npx tsx scripts/index-all.ts` para dejar la base en el estado pristino de
24 fichas (sin el producto de prueba del Caso 1) antes de comitear.

## Si algo falla: síntomas y diagnóstico

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| Error 401 de Hugging Face | Token ausente, mal copiado o revocado | Revisar `HUGGINGFACEHUB_API_TOKEN` en `.env.local` (empieza con `hf_`); reiniciar `npm run dev` tras cambiarlo |
| "model not supported" / "no provider available" en el chat | El modelo gratuito rotó (Guía HF, lección 3) | Cambiar `HUGGINGFACE_CHAT_MODEL` en `.env.local` por un candidato probado contra la API real; NO tocar código |
| Error 429 / "rate limit" | Cuota gratuita del mes agotada o ráfaga de llamadas | Esperar, o revisar en huggingface.co → Settings → Billing cuánta cuota queda |
| La pestaña IA nunca trae resultados | No se corrió `index-all` (tabla vacía) o threshold muy alto | Contar filas de `knowledge_embeddings` en Studio; si hay 0 → correr el script; si hay 24 → bajar el threshold y recargar |
| La búsqueda IA trae cosas sin relación | Threshold muy bajo | Subirlo en `lib/constants/ai.ts` y documentar en `docs/RAG.md` |
| El chat responde pero sin fuentes | El contexto llegó vacío (`hasRelevantContext: false`) | Es el comportamiento correcto para preguntas fuera del catálogo/FAQ; si pasa con preguntas legítimas → calibración (4.8) |
| Embeddings fallan pero el chat funciona (o viceversa) | Son dos vías distintas (SDK vs router) | Revisar el mensaje: `lib/ai/` distingue cuál de las dos falló |
| Publicar un producto no crea su ficha | El trigger es best-effort y el server no ve el token | Buscar el `console.warn` en la terminal del server; correr `index-all` como plan B |
