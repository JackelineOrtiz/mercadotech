# Bitácora — MercadoTech

Registro acumulativo del proyecto, una sección por sesión, la más reciente
primero. Cada entrada documenta lo CONSTRUIDO (no el plan): cuando el
código difiere de la spec de la sesión, se señala como desviación. Fuente:
`git log` del repo — nada de lo que sigue está reconstruido de memoria,
salvo las secciones marcadas explícitamente.

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
