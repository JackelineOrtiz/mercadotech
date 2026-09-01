# Bitácora — MercadoTech

Registro acumulativo del proyecto, una sección por sesión, la más reciente
primero. Cada entrada documenta lo CONSTRUIDO (no el plan): cuando el
código difiere de la spec de la sesión, se señala como desviación. Fuente:
`git log` del repo — nada de lo que sigue está reconstruido de memoria,
salvo las secciones marcadas explícitamente.

---

## Trabajo ad-hoc — Pantallas faltantes para app funcional (2026-09-01, en curso)

Pedido explícito del usuario, fuera del temario de las sesiones: "ayudame a
revisar que esten las pantallas para que sea una aplicacion funcional, no
solo las que pusimos en el pdf". Auditoría inicial encontró seis huecos:
sin 404, sin error boundary, sin recuperación de contraseña, sin "Mi
perfil", sin visibilidad pública del vendedor/storefront, sin panel de
admin. El usuario pidió construirlas todas seguidas ("empecemos con el 404
pero inmediatamente despues implementemos todas las otras pantallas
nuevas"). Cada una sigue el mismo ciclo que las sesiones regulares
(architecture-enforcer → code-reviewer → correcciones → automatic-
validator → commit → push → verificar CI real), documentado acá porque no
tiene Prompt/Fase de spec que lo cubra.

### 404 y error boundary (commit `2575df9`)

`app/not-found.tsx` y `app/error.tsx`, patrón visual mínimo consistente
con el resto de la app (header + `EmptyState`). CI real: success.

### Recuperación de contraseña (commit `a0ce079`)

`/recuperar` (pide el correo) + `/actualizar-contrasena` (nueva
contraseña, solo alcanzable con la sesión de recuperación que
`@supabase/ssr` detecta sola desde la URL). Dos hallazgos reales de
`supabase/config.toml`, encontrados verificando en vivo contra Mailpit
(no simulados): `site_url` tenía un host distinto al de
`NEXT_PUBLIC_SITE_URL` (`127.0.0.1` vs `localhost`), y
`additional_redirect_urls` sin wildcard (`/**`) hacía que GoTrue
descartara en silencio cualquier path del `redirectTo`, cayendo al
`site_url` pelado. CI real: success.

Durante esta fase, un incidente de permisos de filesystem de macOS
(`~/Documents` con EPERM en Read/Bash) interrumpió el trabajo — causa
raíz: un permiso TCC revocado por una actualización del sistema instalada
en paralelo; se resolvió con el reinicio del Mac que el usuario ya iba a
hacer de todos modos. No es un hallazgo del código, se documenta acá solo
porque partió la sesión en dos.

### Mi perfil (commit `3cab82e`)

`/perfil`: editar `display_name`/`phone`, subir avatar (bucket `avatars`,
mismo patrón que `product-images` de la Fase 3.7), y cambiar contraseña.

Dos hallazgos reales, ambos encontrados verificando en vivo (login real
como `buyer1`, no solo tests):

1. **Bug preexistente de `UserMenu.tsx`** (desde que existe el componente,
   nunca notado porque `avatar_path` siempre fue `null` en el seed):
   pasaba `profile.avatar_path` crudo como `src` de `<AvatarImage>` — un
   path de Storage, no una URL. Se resuelve ahora en
   `auth.service.getSession` (mismo patrón que `product.service` con
   `image_url`), y `types/user.ts` gana el campo `avatar_url`.
2. **Cambiar contraseña sin pedir la contraseña actual** (hallazgo del
   code-reviewer): `auth.service.updatePassword` alcanza para
   `/actualizar-contrasena` porque el link del correo YA prueba identidad,
   pero reusado tal cual en `/perfil` habría permitido cambiar la
   contraseña con solo una sesión ambiente — sin reautenticación, un
   navegador compartido o una sesión XSS podría secuestrar la cuenta. Se
   agregó `auth.service.changePassword` (reautentica con
   `signInWithPassword` antes de `updateUser`) y un
   `ChangePasswordForm` dedicado con campo de contraseña actual.

Un tercer hallazgo, encontrado verificando en el navegador real (no en
tests, que usan mocks y por lo tanto no lo hubieran detectado): las tres
acciones de esta página (`updateProfile`, `uploadAvatar`,
`changePassword`) compartían el `loading`/`error` único de
`UseAuthState` — diseñado para acciones que viven cada una en su propia
página (login, register...). Al fallar el cambio de contraseña con la
contraseña actual incorrecta, el error real de Supabase ("Invalid login
credentials") aparecía bajo el formulario de NOMBRE, no bajo el de
contraseña. Se corrigió con estado local (`useState`) por sección en
`app/(shop)/perfil/page.tsx`, sin tocar el contrato de `useAuth` para sus
demás consumidores.

### Storefront público del vendedor (commit `8e88d84`)

`/tienda/[sellerId]`: header con avatar+nombre real del vendedor + grilla
de sus productos activos (reusa `FiltersPanel`/`ProductGrid`/`Pagination`
de `/categoria/[slug]` tal cual, solo cambia el filtro fijo). La ficha de
producto ahora muestra "Vendido por {nombre real}" (antes: nada, ni
siquiera un link) enlazado a la tienda.

La deuda ya documentada ("sin `public_profiles`") se cierra con una
migración nueva (`20260901100000_create_public_profiles_view.sql`): una
vista `public_profiles` (id/display_name/avatar_path, filtrada a
`role = 'seller'`) en vez de tocar la política de `profiles` — un SELECT
público ahí expondría TODAS las columnas (incluido `phone`, GRANT sin
restricción de columnas), mientras que la vista solo expone lo que se
lista. La vista bypassea RLS de `profiles` porque su dueña es `postgres`
(quien corre las migraciones) y Postgres no aplica RLS al dueño de la
tabla subyacente salvo `FORCE ROW LEVEL SECURITY` (que `profiles` no
tiene) — verificado en vivo con `curl` anon: `public_profiles` trae los
2 vendedores del seed, `profiles` directo sigue "permission denied".

Verificado en vivo, sin sesión (visitante anónimo real): `/tienda/<id de
TecnoStore Perú>` muestra exactamente sus 8 productos activos, ninguno de
Gamer Zone Perú; un `id` de un `buyer` o un UUID inexistente devuelven
"Tienda no encontrada" (la vista los excluye a los dos por igual, sin
poder ni necesitar distinguir el motivo).

### Panel de administración (commit `8d252ad`) — cierra el pedido

`/admin` (dashboard: usuarios/pedidos/productos activos/ingresos, con
desglose por rol y por estado) y `/admin/usuarios` (tabla de todos los
usuarios). Mismo patrón de guard que `(seller)/layout.tsx`, pero
ESTRICTO (`role === 'admin'`, sin el bypass "or admin" que sí tiene
`canSell` para vendedores) — expone datos de TODOS los usuarios, no
alcanza con "vendedor o admin".

Decisión de diseño real: `services/admin.service.ts` NO usa el cliente
admin ni reimplementa `mcp/src/shared/stats.ts` (ese vive en `mcp/` para
el asistente de IA, con el cliente admin, ve TODO incluidos productos
inactivos ajenos). El dashboard web corre con la sesión normal del admin
logueado, apoyándose en el bypass "or `is_admin()`" que
`profiles_select_own_or_admin` y `orders_select_buyer_seller_or_admin`
ya tienen (Fase 2.3) — sin RLS nueva, sin Route Handler nuevo.
`products_select_active_or_own` NO tiene ese bypass (decisión documentada
en `policies.sql`), así que "productos activos" en el dashboard es
literalmente lo que cualquiera ve, no un conteo administrativo completo
de TODO lo publicado alguna vez — límite del MVP, aceptado a propósito
en vez de agregar un Route Handler con cliente admin solo para esto.

Hallazgo real del architecture-enforcer: `StatsCards.tsx` importaba
`type { PlatformStats }` directo de `services/admin.service.ts` — el
grep de verificación de `CLAUDE.md` no distingue value de type import.
Corregido con un prop type propio (subset de 4 campos), sin importar del
service.

Verificado en vivo con datos reales: los 6 números del dashboard (y sus
desgloses por estado/rol) coinciden EXACTO con una consulta directa a
Postgres con el service role (S/ 12,490.00 de ingresos, 7 pedidos,
2/0/2/2/1 por estado, 3/2/1 usuarios por rol); un `buyer` navegando a
`/admin` es redirigido al catálogo con el toast correcto; la tabla de
usuarios muestra los 6 reales del seed con nombre/teléfono/rol/fecha.

Con esto se cierran las cinco iniciativas del pedido original ("ayudame
a revisar que esten las pantallas para que sea una aplicacion funcional,
no solo las que pusimos en el pdf"): 404/error, recuperación de
contraseña, Mi perfil, storefront del vendedor, y panel de admin.

### global-error.tsx (commit `dbc5668`) — hallazgo de la re-auditoría

Al cerrar las cinco iniciativas, una segunda pasada de auditoría
("¿queda algún hueco real de app funcional?") encontró que `error.tsx`
(Fase de la iniciativa 404/error de arriba) captura errores de
componentes bajo `app/layout.tsx`, pero NO errores del propio
`app/layout.tsx` (el árbol de `ThemeProvider`/`Toaster`/fuentes) —
Next.js exige un archivo separado, `app/global-error.tsx`, que reemplaza
`<html>`/`<body>` por completo porque se ejecuta cuando el layout raíz ya
falló. El `error.tsx` existente tenía un comentario/nombre de función
(`GlobalError`) que sugería erróneamente ser ese límite externo —
corregido (renombrado a `ErrorBoundary`, comentario actualizado).

Decisión deliberada: `global-error.tsx` NO reusa
`Container`/`EmptyState`/`Button`/`next/link` de `error.tsx` (aunque
ninguno depende de `ThemeProvider`, verificado) — HTML/Tailwind puros,
`<a href>` en vez de `next/link`, para minimizar dependencias justo en
la pantalla de último recurso.

Verificado en vivo con un crash REAL (no simulado): se forzó
temporalmente un `throw` en `RootLayout` detrás de una env var
(`FORCE_ROOT_LAYOUT_CRASH`), se corrió `npm run dev` con la env var
activa, y se confirmó que "Algo salió mal" renderiza por debajo del
overlay de desarrollo de Next — luego se revirtió el cambio (`git diff`
limpio antes de commitear).

### MobileNav.tsx (commit `03c7639`) — segundo hallazgo de la re-auditoría

Verificando `global-error.tsx` en viewport mobile con `admin1` logueado,
dos hallazgos reales más, encontrados en el navegador (no en tests):

1. `MobileNav.tsx` (Sesión 3) tiene su PROPIA lista de links, separada
   de `UserMenu.tsx` — al agregar "Mi perfil" y "Panel admin" a
   `UserMenu` en las iniciativas de arriba, nunca se replicaron acá. Un
   usuario en mobile no tenía forma de llegar a esas dos pantallas
   nuevas. Corregido: mismos dos links, mismas condiciones (`user`/
   `role === 'admin'`).
2. Los 11 `SheetClose` que renderizan `<Link>` en este archivo (Catálogo,
   Favoritos, Carrito, Mi perfil, Mis pedidos, Asistente, Soporte, Panel
   vendedor, Panel admin, cada categoría, Ingresar) no tenían
   `nativeButton={false}` — confirmado en la consola REAL del navegador:
   "Base UI: A component that acts as a button expected a native
   `<button>`...", 10 veces (una por instancia visible en ese momento).
   Preexistente desde que existe `MobileNav.tsx` (Sesión 3), no
   introducido en esta sesión — solo heredado al agregar 2 links más.
   Mismo fix que ya usaba `UserMenu.tsx` para su propio botón con
   `<Link>`. Verificado antes/después: 10 warnings -> 0, con el servidor
   dev reiniciado limpio (mismo problema de chunks de Turbopack
   obsoletos ya documentado en esta bitácora — la primera verificación,
   con el servidor viejo, mostró el warning idéntico incluso DESPUÉS del
   fix, hasta reiniciar).

### useAuth como Context (commit `0727b5e`) — pedido explícito del usuario de re-validar caminos felices/fallo con imagen real y cada rol

Verificando en vivo la subida de avatar con una imagen real (no un mock),
usando `next/link` para navegar (sin reload completo) del Navbar a
`/perfil` y de vuelta: el avatar recién subido aparecía en `/perfil` pero
el ícono del Navbar seguía con las iniciales viejas — EXACTAMENTE la
misma clase de bug que `useCart` documentó en la Fase 6.5 (bug real del
contador del carrito). `useAuth` era un hook "de instancia": cada llamada
(`ShopLayout` para el Navbar, `/perfil`, cada layout de grupo de rutas
para su guard) creaba su propio `useState` — `updateProfile`/
`uploadAvatar` sí llamaban a `loadProfile()`, pero eso solo refrescaba
LA INSTANCIA que hizo la llamada, nunca las demás. El comentario
original del archivo afirmaba que sí propagaba a "UserMenu y esta misma
página" — nunca se había verificado en vivo, y era falso.

A diferencia de `CartProvider` (solo `(shop)/layout.tsx` lo necesita),
`AuthProvider` se agregó en la RAÍZ (`app/layout.tsx`): `(shop)`/
`(seller)`/`(admin)`/`(auth)` son grupos de rutas HERMANOS bajo esa misma
raíz, ninguno anida a los otros, y los 4 llaman a `useAuth()`. Mismo
patrón interno que `useCart`/`CartProvider` (Context + hook que lanza si
se usa fuera del Provider); ningún consumidor existente (18 archivos)
cambió su forma de uso — solo la implementación interna, de "cada uno
crea su estado" a "todos leen la misma instancia real".

Verificado en vivo, dos veces: (1) antes del fix, subir el avatar
actualizaba `/perfil` pero no el Navbar hasta un reload completo; (2)
después del fix, con `supabase db reset` (estado limpio) + servidor dev
reiniciado, login real, click real en el link "Mi perfil" del Navbar
(navegación de CLIENTE, sin reload), subida real de imagen, y el avatar
del Navbar se actualizó AL TOQUE, sin reload — confirmado leyendo
`img.src` del propio DOM antes/después.

### Producto inexistente: mensaje claro en vez de error genérico (commit `98de907`)

Siguiendo la re-verificación de caminos de fallo por rol, un id de
producto con formato válido pero inexistente (o de un producto inactivo
ajeno, oculto por RLS) mostraba el `ErrorState` genérico "Algo salió
mal / Reintentar" — reintentar no ayuda si el producto no existe.
`hooks/useProduct.ts` distingue ahora el código real que devuelve
PostgREST cuando `.single()` no encuentra filas (`PGRST116`, confirmado
contra el REST API real:
`{"code":"PGRST116","details":"The result contains 0 rows"...}`) para
mostrar un `EmptyState` "Producto no encontrado", mismo patrón que
`/tienda/[sellerId]`. Efecto colateral correcto: un producto inactivo
de OTRO vendedor (que RLS ya oculta) también cae en esta rama — "no
encontrado" es la respuesta de seguridad correcta ahí (no confirma que
existe pero está oculto).

### 5ta Skill de gobernanza: `mercadotech-governance-orchestrator` (commit `ff73f9f`)

Pedido explícito del usuario: analizar qué Skills nuevas agilizarían el flujo de trabajo. De 5
ideas propuestas, se construyó la de mayor impacto — un orquestador que colapsa la secuencia
manual `architecture-enforcer` → `code-reviewer` → `automatic-validator` (invocada a mano 9 veces
en el trabajo ad-hoc de esta sección) en una sola invocación que decide sola el orden y cuándo
detenerse.

Probada en vivo contra un cambio real (ver próxima entrada) — esa prueba encontró un hallazgo real
sobre la skill recién creada: `automatic-validator` es (a propósito) un portero binario sin
excepciones, y bloqueaba el ciclo completo por 2 fallos de `test:e2e` que resultaron ser deuda
PRE-EXISTENTE sin relación con el diff evaluado. Se verificó de verdad, no se asumió: `git stash
-u` (confirmando con `git status --short` que el working tree quedó limpio), se re-corrió el test
fallido contra el código SIN el cambio (mismo resultado: 2 fallos idénticos), y `git stash pop`
restauró el cambio. Se agregó un paso al flujo del orquestador para automatizar exactamente esa
verificación: cuando el único motivo de `VALIDACIÓN FALLIDA` es `test`/`test:e2e`, reproduce el
fallo con y sin el diff antes de decidir si bloquea — pre-existente confirmado no bloquea (se
flaggea aparte vía `spawn_task`), una regresión real sigue bloqueando igual que cualquier otro
fallo (lint/type-check/build/enforcer/crítico del reviewer siempre bloquean, sin excepción).

Hallazgo adicional (no una skill, un dato real del propio repo): el job `e2e` del CI real
(GitHub Actions) solo corre Playwright en Chromium — el bug de kanban por teclado de abajo nunca
disparó una alarma en CI porque CI ni siquiera prueba firefox/webkit, donde sí falla. Documentado
como contexto, no corregido (fuera del pedido original).

### Título dinámico de pestaña en `/producto/[id]` (commit `f81d030`) — primera prueba real del orquestador

Hallazgo real, encontrado auditando el repo antes de construir la skill de arriba: TODAS las
páginas de la app comparten el mismo `<title>` "MercadoTech" del layout raíz — cada `page.tsx` es
`"use client"`, y Next.js no permite exportar `metadata`/`generateMetadata` desde un Client
Component. Con varias pestañas de producto abiertas era imposible distinguir cuál era cuál.

`app/(shop)/producto/[id]/page.tsx` volvió a ser Server Component: solo exporta
`generateMetadata` (llama a `getProductById` — mismo service, sin cambios — con el cliente
SERVIDOR de `lib/supabase/server.ts`, ya existente) y renderiza `<ProductoPageClient/>` (nuevo,
misma lógica que tenía `page.tsx` antes, solo renombrado el export). Verificado en vivo en el
navegador: pestaña real con el nombre del producto ("Laptop Lenovo IdeaPad Slim 3... | MercadoTech")
y, para un id inexistente, "Producto no encontrado | MercadoTech" — consistente con el `EmptyState`
del cuerpo. CI real: success (run `33519497025`).

Deuda encontrada durante el code review (no bloqueante, no corregida en este cambio): el `catch`
de `generateMetadata` no distingue `PGRST116` de un error de red genérico — ambos caen al mismo
título "Producto no encontrado", inconsistente con `hooks/useProduct.ts` que sí hace esa
distinción para el cuerpo de la página.

### Fase 7.2 (performance) y 7.3 (secretos) — `docs/PERFORMANCE.md` y `docs/DEPLOY.md`

Medición real con Lighthouse CLI contra build de producción (no `next dev`) en las 4 páginas de
la spec. Dos de los tres candidatos preaprobados (`next/dynamic` en `ChatWindow`/
`OrdersKanban`/`SortableImageGallery`) empeoraron el resultado real medido — `OrdersKanban`/
`SortableImageGallery` mejoraban 3 rutas de vendedor pero inflaban el chunk COMPARTIDO por toda
la app, empeorando justo las páginas que mide el objetivo (home/categoría); revertidos ambos con
evidencia real, aislando la causa con `git stash push -- <archivo>` selectivo. El objetivo
Lighthouse ≥90 no se alcanza (82-86) por una causa raíz real fuera del alcance preaprobado
(Render Delay ~90% del LCP, arquitectura 100% client-rendered) — decisión explícita del usuario de
no ampliar el alcance y documentarlo como deuda técnica. Detalle completo con tablas antes/después
→ `docs/PERFORMANCE.md`. Auditoría de variables/secretos (tabla de gobernanza, greps anti-fuga
reales) → `docs/DEPLOY.md` §1.

### Fase 7.4 (deploy) — Supabase de producción linkeado y migrado

Tarea A completada: proyecto `MercadoTech Datapath` (`gdlugailzawkugfxyxrg`) ya existía (creado al
arrancar el curso), se linkeó y migró desde cero. `supabase login` falló dos veces con
`Error: Could not create CLI login session` (actualizar la CLI 2.115.0 → 2.116.0 no lo resolvió);
se resolvió con `SUPABASE_ACCESS_TOKEN` (token personal generado en el dashboard). `supabase db
push` falló a mitad de las 27 migraciones con `ERROR: type "vector" does not exist (SQLSTATE
42704)` en `20260828100000_grant_service_role_execute_match_knowledge.sql` — bug real
preexistente, nunca antes probado contra un Postgres remoto: esa migración referenciaba `vector`
sin calificar el esquema (`extensions.vector`), y solo funcionaba en local/CI porque
`extra_search_path` de `config.toml` agrega `"extensions"` al `search_path` del stack de
`supabase start`, un ajuste que **no aplica a `supabase db push` contra un proyecto remoto**.
Reproducido y confirmado el fix (`extensions.vector` calificado, mismo patrón que ya usaba
correctamente `create_match_knowledge.sql`) corriendo ambos casos directo contra Postgres local
con `search_path` restringido antes de tocar el archivo real, y validado con `supabase db reset`
completo (27/27 migraciones). Re-corrido `supabase db push`: éxito, producción migrada. Detalle
completo → `docs/DEPLOY.md` §2.

## Sesión 6 — Testing y CI con GitHub Actions (2026-08-29 a 2026-08-31)

Red de seguridad completa: Vitest para lógica pura y `services/` (184
tests, cliente Supabase siempre inyectado — nunca `vi.mock` de
`lib/supabase/*`), Playwright para los dos flujos críticos (comprador y
vendedor, con el drag del kanban por TECLADO), y un pipeline de GitHub
Actions (`checks` + `e2e`) que corre todo en cada push/PR sin ningún
secreto. Absorbió el pipeline de CI que originalmente era la Fase 7.1
(decisión del docente) — la Sesión 7 conserva solo performance, secretos y
deploy.

**Desviación de rango real, antes del Prompt 0:** por un pedido aparte del
usuario ("ayudame con el CI"), se construyó un workflow ad-hoc (commits
`b7c3c96`, `facde21`: jobs `web`/`mcp` con lint/type-check/build) ANTES de
empezar formalmente la Sesión 6. Quedó completamente reemplazado por el
pipeline real de la Fase 6.7 (`checks`/`e2e`) — se documenta acá por
integridad del `git log`, no forma parte de los entregables de la sesión.

### Prompt 0 — Conexión a GitHub e instalación de herramientas de testing (commit `c38b435`)

**Construido:** remoto de GitHub conectado (repo privado), primer push;
`@playwright/test@^1.62.1` + navegadores (chromium/firefox/webkit)
instalados; `@vitest/coverage-v8@^4.1.11`, `vitest@^4.1.11`.

**Verificado real:** estado de partida confirmado contra el repo real
(no asumido) — 15 `services/` con cliente inyectable, cero `data-testid`
en todo el repo, `lib/utils.ts` exporta solo `cn`/`formatPrice`.

### Fase 6.1 — Infraestructura de Vitest (commit `3729520`)

**Construido:** `vitest.config.mts` (extensión `.mts`, no `.ts`, para que
Vitest no advierta "ESM cargado como CommonJS" sin tocar el `package.json`
de la raíz; `import.meta.dirname` en vez de `__dirname`, que ESM no
soporta), alias `@/` igual que `tsconfig.json`, `environment: "node"` (sin
jsdom/Testing Library — no se testean componentes, decisión 6 de la
spec), cobertura v8 con `include: ["lib/**", "services/**"]`. Scripts
`test`/`test:watch`/`test:coverage`.

**Hallazgo real:** ESLint no ignoraba `coverage/` (el reporte HTML
generado) — mismo patrón que `mcp/dist/` en la Sesión 5: gitignorado no
es lo mismo que ignorado por ESLint. Agregado a `eslint.config.mjs`.

### Fase 6.2 — Tests de lógica pura (commit `46f490c`)

**Construido:** `lib/validators/{auth,product}.test.ts`, `lib/utils.test.ts`,
`lib/ai/{context-builder,prompts}.test.ts` — 56 tests, 100% de ramas en
los 5 archivos (confirmado por el reporte HTML de cobertura; el reporte de
texto por defecto OCULTA los archivos con 100%, no es un bug).

**Desviaciones ancladas al código real, no a la spec:** `validateLogin`/
`validateRegister` devuelven `FieldErrors` (`Record<string,string>`)
directo, no un objeto con `.ok`; `isUserRole`/`REGISTRABLE_ROLES` no
existen en el repo (grepeado); `lib/validators/auth.ts` no tiene
constantes exportadas para el mínimo de contraseña/nombre — están
hardcodeadas inline, a diferencia de `product.ts`.

**Verificado real:** el `U+00A0` (espacio de no ruptura) entre "S/" y el
monto de `formatPrice`, y la resolución de conflictos de `cn`
(tailwind-merge), verificados con `node -e` antes de escribir la
aserción — no asumidos.

### Fase 6.3 — Tests de services con Supabase mockeado (commit `cbadf23`)

**Construido:** `services/test-utils/supabase-mock.ts` — mock encadenable
por `Proxy` (soporta cualquier método de PostgREST sin enumerarlos), con
introspección (`calls`/`rpcCalls`/`storageCalls`/`authCalls`,
`inserts`/`updates`/`upserts`/`deletes`); 16 archivos
`services/*.service.test.ts` (184 tests en total contando 6.1-6.3).
`vi.mock` de `lib/ai/*` SOLO en `embedding`/`vector-search`/`chat.service.test.ts`
(única excepción sancionada — esos 3 services no tienen cliente
inyectable); el resto de `lib/ai/*` se deja real (funciones puras).
Refactor mecánico: `canMove` exportado en `useSellerOrders.ts` para
testearlo sin React.

**2 hallazgos reales, documentados con `// comportamiento actual,
revisar:` (no corregidos en esta fase):** `cart.service.ts`'s
`mapCartItem` no reenvía el cliente inyectado a `getPublicUrl` (a
diferencia de `mapProduct`, corregido en la Fase 4.7) — confirmado que
revienta con "WebSocket not found" fuera del navegador. `auth.service.ts`'s
`getSession` silencia el error de leer el profile (ya documentado en su
propio comentario).

**Verificado real:** `services/` en 99.2% líneas (exigido ≥80%), suite
verde con `supabase stop` (sin red).

### Fase 6.4 — Infraestructura de Playwright (commit `d7a7e5c`)

**Construido:** `playwright.config.ts` (webServer `build && start` en CI,
reutiliza `npm run dev` en local; retries 2/0; reporter `github`+`html`);
7 Page Objects (`e2e/pages/`); `e2e/fixtures/test.ts` (login vía Page
Object); `e2e/data/users.ts`; smoke `home.spec.ts`. 30 `data-testid`
nuevos en 16 componentes existentes — SOLO el atributo, cero lógica.

**Hallazgo real:** `react-hooks/rules-of-hooks` daba falso positivo sobre
el parámetro `use` de un fixture de Playwright (coincide con la
heurística de nombre de un hook de React) — `e2e/**` excluido de ESLint.

**Verificado real:** `npm run test:e2e -- home.spec.ts` verde en los 3
navegadores contra Supabase local real.

### Fase 6.5 — E2E: flujo comprador (commit `23f5390`)

**Construido:** `buyer-flow.spec.ts` (8 pasos con `test.step`) y
`buyer-negative.spec.ts` (3 casos), verificados contra datos reales del
seed (el producto con stock 0 real es `b…008`, no `b…06` como asumía el
prompt).

**Bug de producción real, corregido con autorización explícita del
usuario:** `hooks/useCart.ts` era un hook "de instancia" — Navbar,
`/producto/[id]` y `/carrito` creaban cada uno su propio estado aislado
(a diferencia de `useAuth`, que solo "parece" compartir estado porque
`@supabase/ssr` memoiza un único cliente) — agregar al carrito nunca
actualizaba el contador del Navbar. Reemplazado por `hooks/useCart.tsx`
con `CartProvider` + Context, una sola instancia real. 2 hallazgos más,
solo en la infraestructura de test: el selector de "Ingresar" (es
`role="button"`, no `"link"`, por `nativeButton={false}`) y una carrera de
hidratación solo-WebKit en el login (fill de un input controlado antes de
que React termine de hidratar).

**Verificado real:** 15/15 (5 specs × 3 navegadores), dos corridas
independientes; demostración de reporte fallido con screenshot real.

### Fase 6.6 — E2E: flujo vendedor (commit `c0ed568`)

**Construido:** `seller-flow.spec.ts` (publicar con imagen, mover
`pagado`→`enviado` por teclado, persistencia tras `reload`, verificado
desde la cuenta del comprador) y `seller-negative.spec.ts`. Dato real
verificado contra el seed (no asumido): el único pedido `pagado` es de
**seller2/buyer2**, no seller1 — el prompt lo advertía correctamente.

**Verificado real:** 8/8 en chromium contra Supabase local reseteado;
reporte HTML confirmado visualmente (columna "Enviado" en 1, "Pagado" en
0).

### Fase 6.7 — Pipeline de CI en GitHub Actions (commits `e23de97`, `c7132b5`)

**Construido:** `.github/workflows/ci.yml` con jobs `checks` (type-check →
lint → `test:coverage` → type-check de `mcp/` → artefacto de cobertura,
~46-49s) y `e2e` (Chromium + Supabase efímero + credenciales dinámicas vía
`supabase status -o json` + `jq` → `playwright test --project=chromium`,
~4 min); `packageManager: "npm@10.8.2"`.

**Desviación real de la spec (mismo principio "gana el código real"):** la
spec pedía pinnear `npm@11.6.2` y Node 24 — la versión que de verdad
generó `package-lock.json` en este entorno es `npm@10.8.2` sobre Node
`20.20.2` (verificado con `npm --version`/`node --version` antes de
escribir el pin, no asumido).

**Hallazgo real solo reproducible en GitHub Actions:** el primer push
(run `33441154880`) tuvo `e2e` en rojo — el drag del kanban por teclado
pasaba siempre en local (dev y build de producción) pero fallaba en los 3
intentos del runner real. Diagnosticado descargando el trace real
(`gh run download`), no asumido: las pulsaciones llegaban, pero la
medición propia de `boundingBox()` nunca detectaba el cruce de columna
ahí. Fix: `SellerKanbanPage` ahora poll­ea la región
`role="status" aria-live="assertive"` que `@dnd-kit/accessibility` ya
expone con sus propios anuncios de colisión — la fuente de verdad de la
librería, no una reconstrucción de su geometría.

**Verificado real:** push a `main` → `checks`+`e2e` verdes (run
`33442439936`); PR #1 (`ci-smoke`) verde con un cambio trivial → **rojo**
al romper un test a propósito (`checks` falló, `e2e` se saltó) →
revertido → verde de nuevo → cerrado sin merge; artefacto de cobertura
descargado y confirmado real (644KB HTML).

### Fase 6.8 — Debugging y actualización de los gates (commit `7d9bd84`)

**Construido:** `docs/DEBUGGING.md` (flujo síntoma→reproducir→logs→
hipótesis→fix→test, guía de contexto para pedirle debugging a Claude,
tabla de errores típicos con mensaje literal); `mercadotech-automatic-validator`
actualizada quirúrgicamente — `npm run test` pasa de N/A a OBLIGATORIO,
nuevo ítem `npm run test:e2e` condicional a `supabase status`.

**Verificado real, con evidencia empírica extra:** el mensaje de RLS
citado en `DEBUGGING.md` (`new row violates row-level security policy for
table "orders"`) se disparó de verdad contra el Postgres local (`docker
exec` al contenedor), no se asumió por ser "un mensaje típico de
Postgres". Demostración del gate: test roto → `VALIDACIÓN FALLIDA`
citando `lib/utils.test.ts` → revertido (`git checkout --`, byte-exacto)
→ `VALIDACIÓN APROBADA`.

---

## Cierre de Sesión 6

### Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| `npm run test` verde con Docker apagado, cobertura objetivo | ✅ | Fase 6.3; `services/` 99.2% líneas, validadores/`context-builder` 100% ramas |
| `npm run test:e2e` verde contra Supabase local con el seed | ✅ | Fases 6.4-6.6; 8/8 en chromium, 15/15 en 3 navegadores para el flujo comprador |
| Kanban drag & drop cubierto por E2E vía teclado | ✅ | Fase 6.6/6.7 — con el hallazgo real de CI corregido |
| Push y PR de prueba muestran ambos jobs en verde; un test roto los pone en rojo | ✅ | Fase 6.7, runs `33442439936` (verde) y PR #1 (rojo→verde) |
| El validator ejecuta los tests como parte del gate | ✅ | Fase 6.8, demostrado con ambas salidas reales |
| `npm run lint`, `type-check`, `build` pasan | ✅ | Cada fase, última vez en 6.8 |

### Entregables de la spec × estado

| Entregable | Estado | Evidencia |
|---|---|---|
| Infraestructura Vitest + Playwright (`package.json`) | ✅ | Fases 6.1, 6.4 |
| Suite unitaria: lógica pura + services, cobertura objetivo | ✅ | Fases 6.2-6.3, 184 tests |
| 4 specs E2E (comprador/vendedor + negativos) + Page Objects + `data-testid` | ✅ | Fases 6.4-6.6, 8 tests E2E, 30 `data-testid` |
| `.github/workflows/ci.yml` con `checks`+`e2e` verdes + `packageManager` | ✅ | Fase 6.7 |
| `docs/DEBUGGING.md` + validator actualizado + norma en `CLAUDE.md` | ✅ | Fase 6.8 + este cierre |
| Bitácora y `CLAUDE.md` actualizados | ✅ | Este cierre |

### Deuda técnica y limitaciones conocidas (vigentes en el código)

- **`cart.service.ts`'s `mapCartItem` no reenvía el cliente inyectado a
  `getPublicUrl`** (Fase 6.3) — inofensivo hoy (solo se llama desde el
  navegador), replica el bug ya corregido en `product.service.ts` (Fase
  4.7) si algún día se llama con el cliente admin.
- **`auth.service.ts`'s `getSession` silencia el error de leer el
  profile** — ya documentado en su propio comentario, ahora con test que
  lo ancla (Fase 6.3).
- **`SellerKanbanPage.pressUntilOverColumn` depende de la región
  `aria-live` que expone `@dnd-kit/accessibility`** — acoplamiento
  deliberado a un contrato de accesibilidad público de la librería, no a
  un detalle interno (se descartó explícitamente un id autogenerado por
  ser más frágil); documentado en el propio archivo.
- Toda la deuda técnica de las Sesiones 3-5 sigue vigente sin cambios (ver
  esas secciones).

### Pendientes para la Sesión 7 y heredados

- **Sesión 7** (performance, secretos y deploy, según el mapa de
  `README.md`): sin leer todavía. Ya NO incluye CI (absorbido acá).
- **Branch protection** (checks obligatorios para mergear) — declarado
  explícitamente fuera de alcance de la Sesión 6, corresponde a la 7.
- **Tests de componentes React y del servidor MCP** — fuera de alcance
  por decisión de la spec (decisión 6); MCP solo tiene su `type-check` en
  CI.
- **Heredado de sesiones 1-5**: sin pendientes nuevos más allá de los ya
  registrados en cierres anteriores.

---

## Sesión 5 — Custom Skills y Protocolo MCP (2026-08-28)

Cuatro Skills de gobernanza (`.claude/skills/`) que hacen cumplir la
arquitectura y calidad de MercadoTech, y un servidor MCP de solo lectura
(`mcp/`) que expone la plataforma a cualquier cliente MCP, reutilizando
`services/` y `lib/ai/` existentes sin duplicar lógica — cerrado con un lab
real de gobernanza sobre código de las Sesiones 2-4.

### Fase 5.0 — Provisión de dependencias del MCP (commit `1f6a309`)

**Construido:** `mcp/package.json` inicial; `@modelcontextprotocol/sdk`
(resuelto a `^1.30.0` sobre el rango `^1.29.0` pineado — sigue en el major
1.x compatible con zod 3), `zod@^3.25.76`, `tsup@^8.5.1`.

**Hallazgo:** el Inspector de MCP en su tag `latest` (v2, `2.4.0`) y su
propio v1 más reciente (`1.0.2`) ya exigen Node ≥22.7.5; el proyecto corre
en Node 20.20.2. La última versión sin esa exigencia es `0.15.0` — pineada
explícitamente en todas las fases siguientes.

**Corrección:** `.gitignore` de `mercadotech/` solo anclaba `/node_modules`
a la raíz del proyecto Next.js — `mcp/node_modules` (paquete npm propio) no
quedaba ignorado; se agrega sin ancla.

### Fase 5.1 — Skills de gobernanza (commit `a28ea5a`)

**Construido:** `mercadotech-architecture-enforcer` (gate previo, 9 reglas
de ubicación/dependencias, incluidas las del MCP que llegaría en 5.2-5.4),
`mercadotech-code-reviewer` (informe /10 con checklist del dominio: RLS,
snapshots de pedidos, stock vía RPC, orden del pipeline RAG),
`mercadotech-automatic-validator` (binario APROBADA/FALLIDA), y
`mercadotech-tech-lead` (scorecard ponderado, contrasta contra la deuda ya
documentada en esta bitácora antes de reportar un hallazgo). Las 4
declaran explícitamente que reportan, nunca editan código, y cierran con
"CLAUDE.md gana" ante contradicción.

**Verificado real:** tras reiniciar Claude Code, se probó que el enforcer
rechaza correctamente "crea un componente que consulte productos
directamente de Supabase" (regla #1) y que el validator da APROBADA sobre
el repo sin cambios.

### Fase 5.2 — Scaffolding del servidor MCP (commit `9a304d5`)

**Construido:** `mcp/src/index.ts` (redirección de `console.log/info/warn`
a stderr como primer *import*, no primera línea de código — en ESM los
imports se evalúan antes que cualquier statement propio del módulo que los
declara), `server.ts` (`McpServer` vacío), `env.ts` (`loadEnv`, reutiliza
`process.loadEnvFile` de `scripts/index-all.ts` — API nativa de Node, no un
parser manual como sugería la prosa de la spec), `context.ts`
(`createContext()` fábrica por llamada con `{anon, admin}`, nunca importa
`lib/supabase/admin.ts` por el mismo motivo que `index-all.ts`:
`server-only` revienta bajo Node puro), y los helpers de `lib/`.

**Corrección:** `tsconfig.json` de la raíz no excluía `mcp/` — su propio
`type-check` recompilaba `mcp/src/` de forma redundante con el de `mcp/`
mismo; se agrega `"mcp"` a `exclude`. `eslint.config.mjs` no ignoraba
`mcp/dist/` (el build empaquetado que llegaría en la 5.5).

**Verificado real:** `npx tsx mcp/src/index.ts` desde la raíz de
`mercadotech/` no escribe nada en stdout; el Inspector 0.15.0 conecta y
muestra el servidor con 0 tools/resources/prompts.

### Fase 5.3 — Tools (commit `fc1c7a7`)

**Construido:** las 10 tools de solo lectura, un archivo por tool,
registro central en `tools/index.ts`. Cliente explícito por tool: anon
donde los datos son públicos, admin donde la RLS real lo exige
(`semantic_search_products`, `ask_assistant`, `find_related_products` por
`knowledge_embeddings` solo `authenticated`; `get_store_stats`,
`get_order_status` por `orders`/`order_items`). `get_order_status` expone
una lista blanca explícita de campos — nunca `buyer_id`.

**Bloqueo resuelto:** `product.service.getProductsByIds` no existía (la
spec la daba por existente, reportado en el Prompt 1 de la sesión) — se
agregó al service real, reutilizable por toda la app.

**Hallazgo real de infraestructura:** `match_knowledge` es `security
invoker` (Fase 4.1) y nunca tuvo `GRANT EXECUTE` para `service_role` —
hasta esta fase siempre se había llamado con el cliente de sesión (Sesión
4), nunca con el admin. Mismo patrón que el ya conocido "BYPASSRLS ≠
GRANT" de la Fase 4.3, ahora sobre una función; `orders`/`order_items`
tenían el mismo gap de tabla. Corregido con la migración
`20260828100000_grant_service_role_execute_match_knowledge.sql`, confirmado
en vivo contra el Inspector (antes: "permission denied"; después: 200 con
datos reales).

### Fase 5.4 — Resources y Prompts (commit `b32dd36`)

**Construido:** los 7 resources (`info`, `products`, `products/{id}` y
`sellers/{sellerId}` como templates con callback `list`, `categories`,
`faq`, `stats`) y los 5 Prompts MCP (terminología: nunca "Skills" —
`describir_producto`, `comparar_productos`, `redactar_respuesta_pregunta`,
`resumen_de_resenas`, `generar_articulo_faq`), cada uno embebiendo el
contenido real como `resource` dentro del mensaje. `sellers/{sellerId}`
expone SOLO `display_name` + productos activos — nunca `phone`.

**Refactor:** `getProductDetail` se movió del tool `get_product` a
`shared/products.ts` para que el resource `products/{id}` la comparta sin
duplicar; mismo criterio para `getStoreStats` en `shared/stats.ts`.
Servicios nuevos agregados a la app real (no a `mcp/`):
`support-article.service.listPublished`, `question.service.getById`.

**Hallazgo real:** mismo patrón que la 5.3 — `profiles` tampoco tenía
`GRANT SELECT` para `service_role`; el resource `sellers/{sellerId}` lo
necesitaba. Ampliado en la misma migración de la 5.3.

**Verificado real:** `resources/list` con 21 entradas (5 estáticas + 14
`products/{id}` + 2 `sellers/{sellerId}`); con `supabase stop`,
`resources/list` sigue respondiendo (los 2 templates degradan a 0
instancias, `mercadotech://info` sigue funcionando) y un resource caído
devuelve su error capturado en vez de tumbar la conexión.

### Fase 5.5 — Registro y validación (commits `50de0db`, `5003c82`, `5b4b07c`)

**Construido:** `.mcp.json`, `mcp/README.md` completo (arquitectura,
decisiones, tabla de las 10+7+5 × service × cliente, síntomas).

**Hallazgos reales de configuración** (los tres documentados con su
porqué en `mcp/README.md`, corregidos empíricamente contra el Inspector
con el mismo comando/cwd que usa Claude Code): `npx tsx` desde un cwd sin
`node_modules` propio no encuentra el `tsx` local y cae a una copia
cacheada rota — se usa el binario directo,
`mercadotech/node_modules/.bin/tsx`. La resolución del alias `@/*` de
`tsx` depende del cwd real del proceso, no de la ubicación del archivo —
se pasa `--tsconfig` explícito. `env.ts` pasó de resolver `.env.local` por
`process.cwd()` a resolverlo por la ubicación del propio archivo
(`import.meta.url`), robusto sin importar desde dónde se lance el proceso.

**Desviación de la spec, con la app de escritorio real:** `.mcp.json`
terminó viviendo en `mercadotech/.mcp.json` (la raíz del proyecto Next.js),
no en la raíz del repo como se probó primero (mismo nivel que
`.claude/skills/`, que sí se descubre ahí — la ubicación de ambos NO
comparte mecanismo de descubrimiento, confirmado real). Además, una
sesión ya abierta de la app de escritorio no relee `.mcp.json` con una
conversación nueva ni con `/mcp reconnect` — lo que funcionó fue
`claude mcp add --scope user` (rutas absolutas) + cerrar y reabrir la app
por completo. Documentado en `mcp/README.md` para no repetir el
experimento.

**Verificado real desde Claude Code** (no solo el Inspector): "usa la tool
compare_products con las dos laptops" → Lenovo vs HP con precios y
ratings reales; "pídele al asistente de compras una laptop para diseño" →
recomendó ambas laptops citando fuentes, misma calidad que la UI web.

### Fase 5.6 — Lab de validación automática (commits `e76ea81`, `f4e2a9a`, `1958c10`)

**Construido:** `docs/REVISION_S5.md` — `mercadotech-tech-lead` sobre
`services/` y `hooks/` completos (32 archivos, nota 8.2/10) y
`mercadotech-code-reviewer` sobre `lib/ai/`, los 3 Route Handlers y
`mcp/src/` completo (nota 8/10), corridas en esta misma conversación con
las Skills de la 5.1 ya cargadas.

**Resultado del lab:** 2 hallazgos nuevos reales, ambos corregidos —
`cart.service.updateQuantity` no clampeaba al stock (a diferencia de
`addItem`), y `/api/v1/reindex` no verificaba que el caller fuera dueño
del `sourceId` que reindexaba (cualquier usuario autenticado podía forzar
el reindexado de un producto o artículo ajeno, gastando la cuota
compartida de Hugging Face). 2 hallazgos menores aceptados como deuda
nueva (`(err as Error).message` repetido en 21 sitios de 14/16 hooks; el
callback `list` de `sellers/{sellerId}` hace un fetch doble por vendedor).
1 falso positivo descartado (`useProductForm`, 336 líneas, es cohesión de
dominio, no dispersión de responsabilidades). Toda la deuda ya documentada
de las Sesiones 3-4 se justificó con su enlace, sin re-corregir. Cierre:
`VALIDACIÓN APROBADA`.

**Fuera de alcance de la sesión** (declarado explícitamente): monorepo con
workspaces (nota opcional de la spec, no necesario con el catálogo
actual), tools de escritura en el MCP (es de solo lectura a propósito),
agente de voz (Sesión 8), tests automatizados (`npm run test`, Sesión 6).

---

## Cierre de Sesión 5

### Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| MCP Inspector lista y ejecuta las 10 tools sin errores con datos del seed | ✅ | Fase 5.3, reverificado en 5.5/5.6 |
| `ask_assistant` desde MCP produce la misma calidad que la UI web | ✅ | Fase 5.5, verificado desde Claude Code real |
| Con Supabase detenido, `resources/list` sigue respondiendo | ✅ | Fase 5.4 |
| Ninguna tool/resource expone teléfono, email ni nombre de comprador | ✅ | `get_order_status` (lista blanca) y `sellers/{sellerId}` (solo `display_name`), Fases 5.3-5.4 |
| La Skill validator termina en APROBADA sobre el estado final del repo | ✅ | Fase 5.6, `docs/REVISION_S5.md` |
| `type-check` de la raíz Y de `mcp/` pasan; el build de `mcp/` arranca | ✅ | Cada fase, última vez en 5.6 |

### Entregables de la spec × estado

| Entregable | Estado | Evidencia |
|---|---|---|
| 4 Skills commiteadas en `.claude/skills/` | ✅ | Fase 5.1 |
| Servidor MCP: 10 Tools, 7 Resources, 5 Prompts + `mcp/README.md` | ✅ | Fases 5.2-5.5 |
| `.mcp.json` funcional (aprobado y probado desde Claude Code) | ✅ | Fase 5.5 (ubicación corregida sobre la marcha, ver arriba) |
| `docs/REVISION_S5.md` con el ciclo hallazgo → corrección/justificación → VALIDACIÓN APROBADA | ✅ | Fase 5.6 |
| Bitácora y `CLAUDE.md` actualizados | ✅ | Este cierre |

### Deuda técnica y limitaciones conocidas (vigentes en el código)

- **`(err as Error).message` en 21 sitios de 14/16 hooks** — cast sin
  chequeo de tipo; no rompe en la práctica (todo lo que los services de
  este repo lanzan trae `.message` real), pero es inconsistente con
  `toErrorMessage` de `lib/api-response.ts`. Candidato a un helper
  compartido cuando la Sesión 6 traiga tests.
- **El callback `list` de `mercadotech://sellers/{sellerId}` hace un
  fetch doble por vendedor** para armar el listado — inmediato con 2
  vendedores en el seed, no escala si el catálogo de vendedores crece.
- **`source_id` sin FK dura en `knowledge_embeddings`, `hasRelevantContext`
  y demás deuda de la Sesión 4** siguen vigentes sin cambios — ver esa
  sección más abajo.
- Toda la deuda técnica de la Sesión 3 sigue vigente sin cambios.

### Pendientes para la Sesión 6 y heredados

- **Sesión 6** (testing, según el mapa de `README.md`): sin leer todavía.
- **Heredado de sesiones 1-4**: sin pendientes nuevos más allá de los ya
  registrados en cierres anteriores (`docs/COSTOS.md`/`docs/PROMPTS.md` de
  la Sesión 1, si hicieran falta, siguen sin evidencia de haberse
  ejecutado).

---

## Sesión 4 — Integrando IA en tu SaaS con RAG (2026-08-25)

Pipeline RAG completo sobre pgvector: indexar productos y artículos de FAQ
como embeddings, buscarlos por similitud semántica y responder con dos
asistentes conversacionales (compras/soporte) que citan sus fuentes, sobre
el frontend de la Sesión 3.

### Fase 4.0 — Provisión de dependencias de IA (commit `f069ac1`)

**Construido:** `.env.example` documenta `HUGGINGFACEHUB_API_TOKEN`,
`HUGGINGFACE_EMBEDDING_MODEL` y `HUGGINGFACE_CHAT_MODEL` (sin valores);
`npm i @huggingface/inference` (único SDK de IA del proyecto — el resto de
la capa de IA usa `fetch` directo); `npm i -D tsx`.

**Verificado real:** smoke test contra la API real de Hugging Face desde un
script temporal (nunca commiteado): `featureExtraction` con
`sentence-transformers/all-MiniLM-L6-v2` devolvió un vector de 384 números;
un chat completion contra el router OpenAI-compatible con
`meta-llama/Llama-3.1-8B-Instruct` respondió correctamente — ninguno de los
dos modelos había rotado, no hizo falta proponer reemplazo.

### Fase 4.1 — Infraestructura vectorial (commit `423ba5a`)

**Construido:** 4 migraciones nuevas — `enable_pgvector` (extensión en el
schema `extensions`), `create_knowledge_embeddings` (tabla única
discriminada por `source_type` para productos y artículos, `embedding
vector(384)`, índice HNSW `vector_cosine_ops`, `unique(source_type,
source_id, chunk_index)`), `create_match_knowledge` (RPC `security invoker`
que calcula `1 - distancia_coseno` y filtra por umbral), `knowledge_
embeddings_rls` (SELECT solo `authenticated`); `types/database.ts`
regenerado.

**Decisión:** una sola tabla para las dos fuentes (`source_id` sin FK dura,
apuntando a `products.id` o `support_articles.id` según `source_type`) en
vez de dos tablas — permite una misma búsqueda semántica sobre ambos tipos
de contenido sin duplicar el RPC ni el índice.

### Fase 4.2 — Capa de IA y servicio de embeddings (commit `03a81cb`)

**Construido:** `lib/constants/ai.ts` (todos los tunables del pipeline, con
el porqué de cada valor en su comentario); `lib/ai/embeddings.ts`
(`generateEmbedding` vía SDK, `buildProductEmbeddingText`/
`buildSupportArticleEmbeddingText`); `lib/ai/completion.ts`
(`generateCompletion` vía `fetch` al router OpenAI-compatible —
`feature-extraction` no está disponible ahí, por eso las dos vías son
distintas); `lib/ai/prompts.ts`; `services/embedding.service.ts`
(`indexProduct`/`indexSupportArticle`, `vectorToPgvector` para pasarle el
vector a PostgREST como texto).

**Decisión:** el modelo de chat se elige por `HUGGINGFACE_CHAT_MODEL`
(variable de entorno, con default en código), nunca hardcodeado — la
disponibilidad de modelos gratuitos de Hugging Face rota sin aviso.

### Fase 4.3 — Indexación automática (commit `fc1ed0f`)

**Construido:** `app/api/v1/reindex/route.ts`; `services/indexing-
trigger.service.ts` (`triggerReindex`, fire-and-forget); `useProductForm`/
`useSellerProducts` disparan reindex al crear/editar/activar/desactivar/
borrar; `scripts/index-all.ts` (batch completo, cliente admin construido a
mano — `lib/supabase/admin.ts` no es importable fuera de Next por el paquete
`server-only`); migración `grant_service_role_read_for_indexing.sql`.

**Problema → solución:** (1) `service_role` tiene BYPASSRLS pero eso no
sustituye los GRANT de tabla de Postgres — sin `grant select/insert/...`
explícito, el cliente admin del script recibía "permission denied" al leer
`products`/`categories`/`support_articles` (y más tarde `product_images`/
`reviews`, Fase 4.7). Corregido con la migración de grants. (2) Node 20 no
tiene `WebSocket` global; el constructor de `SupabaseClient` inicializa
`RealtimeClient` igual, aunque nunca se use — el script fallaba con "native
WebSocket not found". Corregido con una clase `NoopWebSocketTransport`
pasada como `realtime.transport`.

**Verificado real:** tras `index-all`, 24 filas (14 productos + 10
artículos); publicar un producto nuevo por la UI crea la fila 25 sin correr
el script.

### Fase 4.4 — Búsqueda semántica en el catálogo (commit `33d7f4e`)

**Construido:** `services/vector-search.service.ts` (`searchByEmbedding`
sobre el RPC, `searchProducts` hidrata contra `products` y descarta
huérfanos inactivos/borrados); `app/api/v1/search/semantic/route.ts`;
`hooks/useSemanticSearch.ts`; `/buscar` con pestañas "Coincidencia exacta"/
"Resultados con IA" (Base UI `Tabs`); `ProductCard` con badge de
similitud.

**Decisión:** la IA exige sesión — la pestaña IA y los dos asistentes
muestran "Inicia sesión..." al anónimo en vez de responder. Protege la
cuota gratuita de Hugging Face y evita que `knowledge_embeddings` (RLS solo
`authenticated`) quede inútil para quien no tiene sesión.

**Verificado real:** "audífonos para gimnasio" trae primero productos de
audio deportivo (ver Fase 4.8 para el detalle con datos).

### Fase 4.5 — Constructor de contexto (commit `b33da79`)

**Construido:** `lib/ai/context-builder.ts`, funciones puras (`buildContext`
selecciona fuentes por similitud/presupuesto de caracteres, extrae
`title`/`price`/`image_url`/`category` de `metadata` sin red ni Supabase) —
demostradas con datos de ejemplo en el propio prompt de la fase, sin
levantar el servidor.

### Fase 4.6 — Servicio conversacional (commit `3b4aad7`)

**Construido:** `services/chat.service.ts` (`ask`: embedding de la
pregunta → `searchByEmbedding` → `buildContext` → `generateCompletion`);
`app/api/v1/chat/route.ts` (401/400/422, log estructurado
`retrievedCount/usedSourceCount/hasRelevantContext/contextTruncated` —
insumo real de la calibración de la Fase 4.8); `types/chat.ts`;
`lib/api-response.ts` gana `toErrorMessage` (deduplicado tras aparecer 3
veces: `PostgrestError` es un objeto plano, no un `Error`, y `String(err)`
sobre él da `"[object Object]"`).

**Verificado real:** `curl` al endpoint con sesión devuelve respuesta con
`sources[]`.

### Fase 4.7 — Interfaz del asistente (commit `e816585`)

**Construido:** `hooks/useChat.ts`, `hooks/useMyTickets.ts`; 5 componentes
en `components/chat/` (`ChatWindow`/`ChatMessage`/`ChatInput`/
`LoadingMessage`/`SourcesList` — fuentes de tipo producto enlazan a
`/producto/[id]`, de tipo artículo a `/soporte`); `/asistente`, `/soporte`
(con sección "Mis tickets", solo lectura); `services/ticket.service.ts`;
middleware con `/asistente`/`/soporte` como rutas protegidas; `UserMenu`/
`MobileNav` con las entradas nuevas.

**Bug real encontrado y corregido:** `mapProduct` (de la Sesión 3,
`product.service.ts`) no reenviaba el cliente Supabase inyectado a
`getPublicUrl`, así que bajo `scripts/index-all.ts` (cliente admin) creaba
de encubierto un cliente NUEVO por defecto — reproduciendo el bug de
WebSocket de la Fase 4.3 desde un sitio inesperado. Corregido: `mapProduct`
acepta y reenvía `supabase` opcional; 4 call sites actualizados. TypeScript
detectó un quinto bug real de paso al cambiar la firma:
`seller.service.ts` llamaba `data.map(mapProduct)` a secas, lo que habría
pasado el índice del array como el parámetro `supabase`.

**Verificado real:** conversación completa en el navegador, con fuentes
clicables que abren el producto/artículo correcto (detalle en Fase 4.8).

### Fase 4.8 — Calibración, observabilidad y casos de prueba (commit `56dd592`)

**Construido:** nada nuevo (fase de verificación) — `docs/RAG.md` con los 6
casos de la spec, cada uno con evidencia real (SQL, transcripción, log del
endpoint).

**Verificado real:** indexación automática (24→25 filas al publicar);
recuperación semántica (producto deportivo real publicado en esta misma
fase queda #1 al 52% de similitud); respuesta contextual de compras y de
soporte, cada una citando fuentes reales con link; caso sin información
("¿venden autos usados?") — el modelo admite que no sabe en 2/2 corridas,
aunque la sugerencia de abrir un ticket varió entre corridas (el `system
prompt` ya se lo pide; es variabilidad del LLM, no del código); navegación
desde una fuente al producto correcto.

**Decisión de calibración:** el threshold de similitud se queda en **0.3**.
Con este tamaño de corpus (~10-14 fichas por `source_type`), el piso de
ruido de fondo entre textos sin relación ya ronda 41-47% de similitud
coseno — por encima de 0.3 — así que mover el threshold no distingue
"sin información" de "información real" sin también cortar recomendaciones
legítimas secundarias (ver tabla de datos en `docs/RAG.md`). El filtro real
contra preguntas fuera de dominio lo hace el `system prompt` del LLM,
verificado funcionando en las pruebas de esta fase.

---

## Cierre de Sesión 4

### Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Indexación automática al publicar/editar (sin correr el script a mano) | ✅ | Fase 4.3, reverificado en 4.8 (24→25 filas) |
| Búsqueda semántica encuentra por significado, no solo por palabra literal | ✅ | Fase 4.4, caso 2 de `docs/RAG.md` |
| Asistente de compras responde solo con productos reales, citados | ✅ | Fase 4.6/4.7, caso 3 de `docs/RAG.md` |
| Asistente de soporte responde solo con FAQ real, citada, y admite cuando no sabe | ✅ | Fase 4.6/4.7, casos 4 y 5 de `docs/RAG.md` |
| IA nunca expuesta a usuarios anónimos | ✅ | Fase 4.4/4.7, verificado con sesión cerrada |
| La UI nunca importa `lib/ai/` directamente | ✅ | `grep -rl "lib/ai" components hooks` vacío en las 5 fases con UI nueva |
| `npm run lint`, `type-check` y `build` pasan | ✅ | Cada fase, última vez en 4.8 |

### Entregables de la spec × estado

| Entregable | Estado | Evidencia |
|---|---|---|
| pgvector + `knowledge_embeddings` + `match_knowledge` + RLS | ✅ | Fase 4.1 |
| `lib/ai/` (embeddings, completion, prompts) + `lib/constants/ai.ts` | ✅ | Fase 4.2 |
| Indexación automática + `scripts/index-all.ts` | ✅ | Fase 4.3 |
| Búsqueda semántica en `/buscar` | ✅ | Fase 4.4 |
| Constructor de contexto puro | ✅ | Fase 4.5 |
| `chat.service` + `POST /api/v1/chat` | ✅ | Fase 4.6 |
| `/asistente`, `/soporte`, componentes de chat, Mis tickets | ✅ | Fase 4.7 |
| `docs/RAG.md` con los 6 casos + calibración | ✅ | Fase 4.8 |
| `docs/BITACORA.md` + `CLAUDE.md` actualizado | ✅ | Este cierre |

### Deuda técnica y limitaciones conocidas (vigentes en el código)

- **`source_id` sin FK dura** en `knowledge_embeddings`: al borrar un
  producto o artículo su ficha queda huérfana hasta el próximo
  `index-all` o hasta que el reindex best-effort la limpie;
  `vector-search.service` ya descarta huérfanos al hidratar, así que no es
  visible en la UI — es deuda de limpieza de datos, no de comportamiento.
- **`hasRelevantContext` no distingue "sin información" de "corpus
  pequeño con ruido de fondo alto"** — con threshold 0.3, el corpus actual
  (~10-14 fichas por tipo) casi siempre devuelve 5 fuentes; el filtro real
  contra preguntas fuera de dominio es el `system prompt` del LLM, no el
  threshold (decisión documentada en Fase 4.8 y `docs/RAG.md`). Si el
  corpus crece, vale la pena recalibrar.
- **La sugerencia de abrir un ticket ante "sin información" es del LLM, no
  determinista** — el `system prompt` ya se lo pide explícitamente
  (`lib/ai/prompts.ts`); en las pruebas de la Fase 4.8 apareció en algunas
  corridas y en otras no, aunque el modelo nunca inventó una respuesta.
- **Sin streaming**: la respuesta del asistente llega completa, no token a
  token — fuera de alcance declarado de la sesión.
- **Sin crear tickets desde el chat**: `services/ticket.service.ts` solo
  lista (`listMine`); crear tickets llega con el agente de la Sesión 8.
- **Sin voz**: texto puro en ambos asistentes; la Sesión 8 la agrega sobre
  esta misma base de conocimiento.
- **Modelos de Hugging Face pueden rotar sin aviso** (nivel gratuito): el
  Prompt 0 de esta sesión los verificó vigentes; si dejan de responder, el
  fix es cambiar `HUGGINGFACE_CHAT_MODEL`/`HUGGINGFACE_EMBEDDING_MODEL` en
  `.env.local`, nunca el código (tabla de síntomas en `docs/RAG.md`).
- Toda la deuda técnica de la Sesión 3 sigue vigente sin cambios (ver esa
  sección más abajo).

### Pendientes para la Sesión 5 y heredados

- **Sesión 5** (según el mapa de `README.md`): sin leer todavía — pendiente
  hasta que se ejecute su Prompt 0/1.
- **Heredado de sesiones 1-3**: sin pendientes nuevos más allá de los ya
  registrados en el cierre de la Sesión 3 (`docs/COSTOS.md`/`docs/
  PROMPTS.md` de la Sesión 1, si hicieran falta, siguen sin evidencia de
  haberse ejecutado).

---

## Sesión 3 — UI Inteligente y Frontend Multimodal (2026-08-24)

Todas las pantallas del mapa de rutas + hooks + services + drag & drop
(galería del vendedor y kanban de pedidos), sobre el backend de la Sesión 2.

### Fase 3.0 — Provisión de herramientas (commit `6022202`)

**Construido:** `.env.local` con credenciales del stack local; `supabase db
reset` inicial; `lucide-react` + `@dnd-kit/{core,sortable,utilities}`; 16
componentes shadcn/ui instalados; scripts `type-check`/`db:types` en
`package.json`; `MercadoTech_sesion3.md` y `Design.pdf` (wireframes)
copiados al repo.

### Fase 3.1 — Tipos generados, tema y componentes base (`af474db`)

**Construido:** `types/database.ts` (generado con `supabase gen types`),
tipos de dominio (`Product`, `Order`, `Profile`...) que estrechan columnas
`text` genéricas a los literal types de `lib/constants/roles.ts`; tema
azul eléctrico en `globals.css`; `next.config.ts` con `remotePatterns` para
Supabase local y hosted; `formatPrice` en `lib/utils.ts`; 7 componentes en
`components/shared/`; `app/dev/ui/page.tsx` como muestra (eliminada en la
Fase 3.8, su propósito era temporal).

**Decisión:** `numeric(12,2)` llega como `string` desde PostgREST — se fija
el patrón (services convierten con `Number()`, componentes reciben
`number`) desde el primer archivo de tipos, no ad hoc en cada fase.

**Fuera de alcance:** conectar los componentes a datos reales (nacen
puros, cada fase posterior los conecta a su hook).

### Fase 3.2 — Layouts, navegación y mapa de rutas (`586524d`)

**Construido:** layout raíz (Geist, `ThemeProvider`, `Toaster`); layouts
`(shop)`/`(seller)`/`(auth)`; 8 componentes puros en `components/layout/`;
las 14 rutas del mapa como placeholder `EmptyState`. Se borra
`app/page.tsx` (colisionaba con `(shop)/page.tsx`).

**Problema → solución:** (1) `@base-ui/react` no soporta `asChild`
(convención de Radix) sino `render={<Elemento>}` — build fallaba en los 5
archivos que envolvían un `Link`/`Button`; corregido. (2) `--font-sans` en
`globals.css` era autoreferencial y se aplicaba en `<html>`, un ancestro
de donde `next/font` define `--font-geist-sans` (en `<body>`) — las
variables CSS no heredan hacia abajo entre esos dos puntos, así que la app
entera renderizaba en el serif del navegador desde la Fase 2.1 sin que
nadie lo notara. Corregido: `--font-sans` apunta a `--font-geist-sans` y
`font-sans` se aplica en `body`.

**Decisión:** panel del vendedor bajo el prefijo `/vendedor/...` para que
`/pedidos` (comprador) y `/vendedor/pedidos` (vendedor) no colisionen.

### Fase 3.3 — Autenticación (`2fdc505`)

**Construido:** migración nueva `20260824100000_handle_new_user_metadata.sql`
(única migración adicional prevista por la spec); `lib/validators/auth.ts`;
`services/auth.service.ts`; `hooks/useAuth.ts`; `LoginForm`/`RegisterForm`;
`/login`, `/register`; middleware de rutas protegidas; guard de rol en el
layout del vendedor.

**Decisión:** registrarse como `seller` es imposible por la vía normal
(`handle_new_user` fijaba `role='buyer'` y `protect_profiles_role`, Fase
2.3, bloquea que el usuario cambie su propio rol después) — se reemplaza
`handle_new_user` para que lea `role`/`display_name` de
`raw_user_meta_data` en el signup, sin tocar la migración original de la
Fase 2.2 ni `protect_profiles_role`. `role` inválido (incluido `admin`,
para que nadie se autopromueva vía metadata) cae a `buyer`.

**Verificado real:** registro "Quiero vender" → `profiles.role='seller'`
confirmado en la base; intento de `role:'admin'` vía API directa (sin
pasar por el form) → queda `buyer`; anónimo en rutas protegidas → 307 a
`/login?redirectTo=`; `/producto` sigue público a propósito.

### Fase 3.4 — Catálogo de productos (`586f466`)

**Construido:** `lib/constants/catalog.ts`; `storage.service.getPublicUrl`
(nace con un solo método, se amplía en 3.7); `category.service.ts`;
`product.service.ts` (`listActiveProducts` con filtros/orden/paginación,
`mapProduct` centraliza la conversión `numeric→number` + `image_url`
resuelta + `average_rating`); `useCategories`/`useProducts` (filtros en
`searchParams`); `ProductCard`/`ProductGrid`/`FiltersPanel`/`Pagination`;
`/`, `/categoria/[slug]`, `/buscar` reusan el mismo grid.

**Problema → solución:** (1) mismatch de hidratación en `Select.Value` de
Base UI (no auto-resuelve el label de un item como Radix) — corregido
pasándole la función resolutora explícita. (2) bug real en
`supabase/seed.sql` (Fase 2.5, sin tocar por regla de la sesión):
`image_path` se guardó con el nombre del bucket duplicado — saneado en
`storage.service.ts`, no en el seed.

**Verificado real:** 14 productos activos en 2 páginas; `/categoria/laptops`
excluye la laptop inactiva del seed; `?condition=nuevo` recargable y
compartible por URL.

### Fase 3.5 — Detalle, preguntas, reseñas y favoritos (`89c87b1`)

**Construido:** `question.service.ts`, `review.service.ts` (`canReview`
espeja `reviews_insert_verified_purchase` exactamente), `favorite.service.ts`;
`useProduct`/`useQuestions`/`useReviews`/`useFavorite`/`useFavorites`;
`ProductGallery` (teclado ←/→), `BuyBox`, `QuestionsSection`,
`ReviewsSection`; `/producto/[id]`, `/favoritos`.

**Decisión:** sin nombre de autor en preguntas/reseñas ("Comprador
verificado"/"Usuario") — `profiles` solo es legible por su dueño o un
admin (RLS, Fase 2.3); una vista `public_profiles` está fuera de alcance
de esta sesión (restricción explícita de la spec).

**Verificado real:** `buyer1` en un producto ya reseñado no ve el
formulario (ve su reseña real); tras marcar un pedido `entregado` en la
base, `buyer2` sí ve el formulario y envía una reseña real; favorito
persiste tras recargar.

### Fase 3.6 — Carrito, checkout simulado y mis pedidos (`b9516d7`)

**Construido:** `lib/constants/orders.ts`; `types/cart.ts`;
`cart.service.ts` (suma cantidad si el producto ya está en el carrito,
clamped al stock); `order.service.ts` (`checkout()` vía RPC
`create_order_from_cart` — único camino, nunca INSERT directo);
`useCart`/`useOrders`; `CartItemRow`/`CartSummary`/`OrderCard`/
`OrderItemsTable`; `/carrito`, `/pedidos`, `/pedidos/[id]` con diálogo de
cancelación.

**Problema → solución:** `CartItem` vivía dentro de `services/cart.service.ts`
e importado por un componente — viola la regla de capas (componentes
nunca importan de `services/`, ni para tipos). Movido a `types/cart.ts`.

**Verificado real:** checkout descuenta stock y vacía el carrito;
checkout con stock insuficiente muestra el mensaje exacto de Postgres, no
crea pedido ni toca el carrito (la transacción aborta completa); cancelar
solo funciona en `pendiente`; un comprador no puede abrir el pedido de
otro por URL directa (RLS + `single()` sin match → `ErrorState`, no
distinguible de "no existe" — comportamiento deseado).

### Fase 3.7 — Panel del vendedor con drag & drop (`719867d`)

**Construido:** `lib/constants/product.ts`, `lib/validators/product.ts`;
`seller.service.ts` (`listMyProducts`, CRUD, `deleteProduct` traduce el
error `23503` de la FK a mensaje legible, `listMyOrders` solo con ítems
propios, `updateOrderStatus`); `storage.service.ts` ampliado
(`uploadProductImage`, `deleteProductImage`, `saveImageOrder`);
`useSellerProducts`, `useSellerOrders`, `useProductForm`;
`ProductsTable`/`ProductForm`/`SortableImageGallery` (drag & drop #1,
`@dnd-kit/sortable`) /`OrdersKanban`+`OrderKanbanCard` (drag & drop #2,
`@dnd-kit/core`); las 4 rutas `/vendedor/...`.

**Decisión no prevista en la spec:** la RLS de `orders`
(`orders_update_seller_advance_or_buyer_cancel`) no restringe el destino
para la rama del vendedor — solo repite `is_order_seller(orders.id)` en el
`WITH CHECK`, así que a nivel de base el vendedor SÍ podría poner
`cancelado` o retroceder el estado. `useSellerOrders` es la única barrera
real contra esas dos reglas, no una capa redundante sobre RLS.

**Bug real encontrado y corregido:** `products_select_active_or_own`
permite leer cualquier producto ACTIVO, no solo los propios — sin guarda
adicional, un vendedor podía abrir la URL de edición de un producto activo
ajeno y ver sus datos en el formulario (la escritura sí la bloquea RLS, la
lectura no). `useProductForm` compara `seller_id` tras cargar y expone
`loadError` si no coincide.

**Desviación de la spec:** el pedido multi-vendedor del seed es `c…01`
(Lenovo de un vendedor + HyperX del otro), no `c…04` como asumía el
prompt de la fase — se verificó "solo mis ítems, no `orders.total`" contra
el pedido real.

**Verificado real:** publicar con 3 imágenes reordenadas → `position`
correcto y portada correcta en el catálogo; reorden en modo edición
persiste sin recargar; mover un pedido un paso adelante → `PATCH` real en
la base; moverlo dos pasos → rechazado por el hook, sin `PATCH`; soltar en
"Cancelado" → bloqueado; eliminar un producto con ventas → mensaje de
"desactívalo", no 500 crudo.

### Fase 3.8 — Responsive, accesibilidad y estados (`7aa37be`)

**Construido:** `docs/SESION3_CHECKLIST.md` (14 rutas × 7 criterios).

**Correcciones** (sin funcionalidad nueva, solo estados/responsive/a11y):
capa (`useAuth` llamaba a `@/lib/supabase` directo, movido a
`auth.service.ts`); tres `EmptyState` sin acción sugerida; miniaturas
arrastrables de la galería sin nombre accesible; scroll horizontal de
página completa en 375 px en todo el panel del vendedor (`ProductsTable`
+ flex row sin `min-w-0` — clásico gotcha de Tailwind/flexbox); buscador
del navbar reducido a ~48 px reales en 375 px. Detalle completo, con
evidencia de cada una, en el checklist.

**Limpieza:** `app/dev/ui/page.tsx` eliminado (era la muestra temporal de
la Fase 3.1); sin placeholders "Próximamente" sobrevivientes.

---

## Cierre de Sesión 3

### Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Flujo comprador completo (registro → explorar → filtrar → detalle → preguntar → carrito → checkout → ver pedido → cancelar) | ✅ | Verificado tramo por tramo en vivo en 3.3–3.6, contra la base real |
| Flujo vendedor completo (registro → publicar con imágenes reordenadas → visible en catálogo → recibir pedido → moverlo por el kanban → comprador ve el nuevo estado al recargar) | ✅ | Fase 3.7, `seller1`/`seller2`/`buyer3` reales |
| Reseña solo tras pedido `entregado` (UI y RLS) | ✅ | Fase 3.5, verificado con cambio real de estado en la base |
| Transiciones inválidas del kanban rechazadas en el hook sin llegar al service | ✅ | Fase 3.7 y reverificado en 3.8 (sin `PATCH` nuevo) |
| `npm run lint`, `type-check` y `build` pasan | ✅ | Cada fase, última vez en 3.8 |
| `grep -rl "@/lib/supabase" components hooks` vacío | ✅ | Corregido en 3.8 (antes: `hooks/useAuth.ts`) |

### Entregables de la spec × estado

| Entregable | Estado | Evidencia |
|---|---|---|
| `types/database.ts` + tipos de dominio; sistema visual + componentes base | ✅ | Fase 3.1 |
| Navegación completa (shop/vendedor/auth), responsive, mapa de rutas | ✅ | Fases 3.2, 3.8 |
| Auth: registro con rol, login, logout, middleware, guard de rol | ✅ | Fase 3.3 |
| Catálogo con filtros en URL, búsqueda, paginación; detalle con Q&A/reseñas/favoritos | ✅ | Fases 3.4, 3.5 |
| Carrito persistente + checkout simulado transaccional + pedidos + cancelación | ✅ | Fase 3.6 |
| Panel vendedor: CRUD, galería drag & drop, kanban drag & drop | ✅ | Fase 3.7 |
| Hooks y services por dominio, cliente inyectable | ✅ | Todas |
| `docs/SESION3_CHECKLIST.md` | ✅ | Fase 3.8 |
| `docs/BITACORA.md` + `CLAUDE.md` actualizado | ✅ | Este cierre |

### Deuda técnica y limitaciones conocidas (vigentes en el código)

- **Sin nombres de otros usuarios**: `profiles` solo es legible por su
  dueño o un admin (RLS, Fase 2.3) — preguntas/reseñas muestran "Usuario"/
  "Comprador verificado". Resolverlo exige una vista `public_profiles`,
  fuera de alcance declarado de la Sesión 3.
- **Cancelar un pedido no repone stock**: no hay trigger para eso
  (decisión de la Fase 2.2/3.6, documentada en la UI).
- **Pedido multi-vendedor**: cada vendedor ve y suma solo sus ítems, pero
  mover el estado en el kanban afecta el pedido completo (columna
  `orders.status` es una sola, sin desglose por vendedor) — limitación del
  modelo de datos, no de la UI.
- **El vendedor podría, a nivel de RLS puro, poner `cancelado` o
  retroceder el estado de un pedido** — la política no lo prohíbe, solo
  el hook `useSellerOrders`. Documentado en el comentario del hook y en la
  Fase 3.7 de esta bitácora.
- **Sin realtime**: el comprador ve el nuevo estado de su pedido recién al
  recargar, no en vivo cuando el vendedor lo mueve.
- **Checkout simulado**: no hay pasarela de pago real ni se piden datos de
  tarjeta — texto explícito en `CartSummary`.
- **Imágenes del seed no existen en Storage** (gap documentado desde la
  Fase 2.5) — todo `<Image>` de producto pasa por `ProductImage`, que
  muestra un placeholder ante el 404.
- **Sin panel admin** ni Route Handlers en `app/api/v1/` — quedan fuera a
  propósito, restricción explícita de la Sesión 3.
- **`@supabase/supabase-js` avisa que Node 20 y anteriores quedarán
  deprecados** — advertencia del build, no bloquea nada todavía.

### Pendientes para la Sesión 4 y heredados

- **Sesión 4** (según el mapa de `README.md`): pgvector + embeddings +
  búsqueda semántica + asistente de compras y soporte en texto, sobre
  `MercadoTech_sesion4.md` (no leído todavía).
- **Heredado de Sesión 2**: ninguno — las Fases 2.6 (`supabase/tests/rls-validation.sql`)
  y 2.7 (`docs/ARQUITECTURA.md`) están completas y commiteadas
  (`c282a7e`, `218c327`); el prompt de cierre de la Sesión 3 asumía que
  podían seguir pendientes, pero el `git log` real de este repo las tiene
  hechas.
- **Heredado de Sesión 1**: sin pendientes registrados — el bootstrap
  (`3db6267`) entregó repo + `CLAUDE.md` inicial + specs; la Sesión 1 del
  curso también pedía una estrategia de costos/modelos y una biblioteca de
  prompts (`docs/COSTOS.md`, `docs/PROMPTS.md` según el mapa de
  `README.md`) que no se generaron — no hay evidencia en el `git log` de
  que se hayan ejecutado esas fases; si hacen falta, son trabajo pendiente
  de la Sesión 1, no de la 4.

---

## Sesión 2 — Arquitectura Escalable y Backend con Supabase (2026-08-19 a 2026-08-21)

*Reconstruida a partir de commits — esta sección no se escribió durante la
ejecución de la Sesión 2, sino al cerrar la Sesión 3, leyendo `git log`.*

- **Fase 2.1** (`2c38223`, 2026-08-19): proyecto Next.js 15.5.23 pinneado
  (evitar Next 16 de `@latest`), estructura de carpetas completa, los 4
  clientes de Supabase (`client`/`server`/`middleware`/`admin`, este
  último `server-only`).
- **Fase 2.2** (`abaaedb`, 2026-08-19): 16 migraciones — 14 tablas con RLS
  habilitado (sin políticas todavía) y `create_order_from_cart`
  (`SECURITY DEFINER`, `FOR UPDATE`, snapshot transaccional).
- **Fase 2.3** (`5cd51bd`, 2026-08-19): políticas RLS de las 14 tablas,
  `is_admin()`, `protect_profiles_role`, GRANTs de columna. Un GRANT
  `SELECT` faltante en `profiles` se encontró y corrigió verificando con
  pruebas funcionales reales, no solo SQL.
- **Fase 2.4** (`b1abffe`, 2026-08-21): buckets `product-images`/`avatars`
  (públicos, 5 MB, JPEG/PNG/WEBP), políticas por carpeta propia. Verificado
  con subidas HTTP reales contra Storage.
- **Fase 2.5** (`6b67bb1`, 2026-08-21): `seed.sql` (6 usuarios, 16
  productos, pedidos en los 5 estados...). Dos bugs reales encontrados
  probando contra la API (no solo SQL): faltaba `auth.identities` para
  poder loguear, y **recursión infinita** entre las políticas de `orders`/
  `order_items` de la Fase 2.3 — resuelta con `is_order_buyer()`/
  `is_order_seller()` (`SECURITY DEFINER`, mismo patrón que `is_admin()`).
- **Fase 2.6** (`c282a7e`, 2026-08-21): `supabase/tests/rls-validation.sql`,
  43 escenarios (9 mínimos + 12 extra derivados de leer las políticas
  reales) — 0 fallas de seguridad.
- **Fase 2.7** (`218c327`, 2026-08-21): `docs/ARQUITECTURA.md`. Se
  encontró y corrigió que `eslint.config.mjs` no ignoraba `supabase/**`
  y lintiaba el bundle interno de `supabase start`.

---

## Sesión 1 — Fundamentos, Setup y Estrategia de Costos (2026-08-19)

*Reconstruida a partir de commits.*

- **Bootstrap** (`3db6267`, 2026-08-19): `.gitignore`, `CLAUDE.md`
  inicial, `docs/` vacía, specs del curso (`README.md`,
  `MercadoTech_sesion2.md`) agregadas al repo.

Sin evidencia en `git log` de que se haya ejecutado el resto de la Sesión
1 (estrategia de costos/modelos, biblioteca de prompts, test A/B, según el
mapa curso→sesión de `README.md`) — no se documenta como completo ni como
explícitamente fuera de alcance; queda como pendiente heredado.
