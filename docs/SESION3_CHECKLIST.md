# Checklist Fase 3.8 — Responsive, accesibilidad y estados

Pasada de calidad sobre las 14 rutas del mapa de la Fase 3.2. Sin
funcionalidad nueva: solo estados (skeleton/vacío/error), responsive,
teclado, imágenes y tema. Verificado en el navegador real (375 px, 768 px,
1280 px, claro y oscuro), no solo por lectura de código.

Columnas: **Responsive** (375/768/1280, sin scroll horizontal) · **Carga**
(`Skeleton`, no spinner genérico) · **Vacío** (`EmptyState` con acción) ·
**Error** (`ErrorState` con `onRetry` funcional) · **Teclado** (Tab /
`KeyboardSensor` en drag & drop) · **Imágenes** (`ProductImage`/`next/image`
con alt significativo) · **Tema** (claro/oscuro sin contraste roto).

| Ruta | Responsive | Carga | Vacío | Error | Teclado | Imágenes | Tema |
|---|---|---|---|---|---|---|---|
| `/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/buscar?q=` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/categoria/[slug]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/producto/[id]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/favoritos` | ✅ | ✅ | ✅ (fix) | ✅ | ✅ | ✅ | ✅ |
| `/carrito` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/pedidos` | ✅ | ✅ | ✅ (fix) | ✅ | ✅ | ✅ | ✅ |
| `/pedidos/[id]` | ✅ | ✅ | n/a | ✅ | ✅ | n/a | ✅ |
| `/vendedor/productos` | ✅ (fix) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/vendedor/publicar` | ✅ | ✅ | n/a | n/a | ✅ | ✅ (fix) | ✅ |
| `/vendedor/productos/[id]/editar` | ✅ | ✅ | n/a | ✅ | ✅ | ✅ (fix) | ✅ |
| `/vendedor/pedidos` | ✅ | ✅ | ✅ (fix) | ✅ | ✅ | n/a | ✅ |
| `/login` | ✅ | n/a | n/a | ✅ | ✅ | n/a | ✅ |
| `/register` | ✅ | n/a | n/a | ✅ | ✅ | n/a | ✅ |

`n/a` = la pantalla no tiene ese estado por diseño (ej. `/login` no lista
nada que pueda estar "vacío"; `/pedidos/[id]` siempre tiene ≥1 ítem porque
un pedido nunca se crea sin ítems). `(fix)` = corregido durante esta fase,
ver "Correcciones aplicadas" abajo.

## Correcciones aplicadas

1. **`hooks/useAuth.ts` — violación de capas.** El hook llamaba a
   `createClient()` de `@/lib/supabase/client` directamente (dos veces:
   para `loadProfile` y para `onAuthStateChange`), en vez de pasar por
   `services/auth.service.ts`. Es el único hook que aparecía en el primer
   grep de la spec. Se agregaron `authService.getSession()` (usuario +
   profile en un solo viaje, mismo comportamiento exacto que el código
   inline que reemplaza — errores silenciados igual que antes) y
   `authService.onAuthStateChange()` (envuelve la suscripción y devuelve
   la función de limpieza) a `services/auth.service.ts`; se eliminó
   `getCurrentUser` (dead code, no lo llamaba nadie). El contrato externo
   de `useAuth()` — la forma de `{user, profile, initializing, ...}` que
   consumen todas las páginas — no cambió.

2. **`app/(shop)/favoritos/page.tsx`, `app/(shop)/pedidos/page.tsx`,
   `app/(seller)/vendedor/pedidos/page.tsx` — `EmptyState` sin acción.**
   Las tres mostraban título/descripción pero ningún botón, a diferencia
   de `/carrito` (que ya tenía "Explorar productos", usado como
   referencia). Se agregó `action` a las tres: favoritos y pedidos del
   comprador → "Explorar productos" (`router.push("/")`); pedidos del
   vendedor → "Publicar producto" (link a `/vendedor/publicar`), más útil
   que "explorar" para un vendedor sin pedidos todavía.

3. **`components/seller/SortableImageGallery.tsx` — imagen sin alt
   significativo.** El `<Image>` de cada miniatura tenía `alt=""` y el
   `<div>` arrastrable que lo envuelve (con los `attributes`/`listeners`
   de `useSortable`, que le dan `role="button"` y lo hacen foco-able) no
   tenía ningún nombre accesible — un lector de pantalla no anunciaba nada
   útil al enfocarlo con Tab. Se agregó `aria-label` al contenedor
   (`"Imagen N de M"`, con `"(portada)"` cuando aplica) y se dejó `alt=""`
   en la imagen a propósito: es decorativa respecto al nombre que ya lleva
   el contenedor, mismo patrón que los thumbnails de `ProductGallery`
   (Fase 3.5, con `aria-label` en el `<button>` que los envuelve).

4. **`app/(seller)/layout.tsx` — scroll horizontal de página completa en
   375 px.** El contenido del panel del vendedor vive en un
   `<div className="flex-1">`, hijo de `<div className="flex min-h-screen">`
   (flex **row**). `ProductsTable` usa celdas `whitespace-nowrap`
   (heredado de `components/ui/table.tsx`), así que su ancho mínimo de
   contenido es grande; con `flex-direction: row` el `min-width: auto` por
   defecto de un flex item le impide encogerse por debajo de ese ancho
   mínimo, y el `overflow-x-auto` propio de `Table` deja de importar
   porque el contenedor que debería recortarlo ya creció con él —
   `document.body.scrollWidth` llegaba a 985 px en un viewport de 375 px.
   Se agregó `min-w-0` al `div` (clásico fix de Tailwind/flexbox para este
   patrón). Confirmado en el navegador: `bodyScrollWidth` pasó a 375 = 375
   (viewport) en `/vendedor/productos`, `/vendedor/publicar` y
   `/vendedor/productos/[id]/editar`. `app/(shop)/layout.tsx` usa
   `flex-direction: column` para el mismo tipo de wrapper (`<main
   className="flex-1">`) — ahí `flex-1` gobierna la altura, no el ancho,
   así que no comparte el problema; se confirmó igual que `OrderItemsTable`
   (misma clase `whitespace-nowrap`) no desborda en `/pedidos/[id]`.

5. **`components/layout/Navbar.tsx` — buscador inservible en 375 px.**
   La fila del header tiene `menú + logo + buscador(flex-1) + carrito +
   usuario`; los cuatro elementos que no son el buscador son `shrink-0`,
   así que en 375 px el buscador —el único `flex-1`— quedaba con ~48 px
   reales (medido con `getBoundingClientRect`): apenas el ícono de lupa,
   sin espacio para escribir ni ver lo que se escribe. `MobileNav` tampoco
   ofrece una alternativa de búsqueda en su menú. Se ocultó el buscador de
   la fila principal en `< md` (`hidden flex-1 md:block`) y se agregó una
   segunda fila, ancho completo, visible solo en `< md`, con el mismo
   `SearchBar` — mismo patrón que usa Mercado Libre en mobile.

## Limpieza

* `app/dev/ui/page.tsx` (muestra de componentes de la Fase 3.1) — eliminado,
  junto con el directorio `app/dev/` (quedó vacío).
* `grep -rn "Próximamente" app components` → vacío; ningún placeholder de
  fase sobrevivió a la 3.7.

## Verificación de capas

```bash
$ grep -rl "@/lib/supabase" components hooks
(vacío)

$ grep -rl "from \"@/services" components
(vacío)
```

Ambos vacíos tras la corrección #1 (antes, el primero devolvía
`hooks/useAuth.ts`).

## `npm run lint` / `npx tsc --noEmit` / `npm run build`

Los tres pasan limpios después de las 4 correcciones y la limpieza. El
build genera las 14 rutas del mapa (antes 15, con `app/dev/ui`).

## Criterios de aceptación de la sesión

* **Flujo comprador completo** (registro → explorar → filtrar → detalle →
  preguntar → carrito → checkout → ver pedido → cancelar si pendiente):
  verificado tramo por tramo en vivo a lo largo de las Fases 3.3–3.6 contra
  la base de datos real (login de los 6 usuarios del seed, checkout que
  descuenta stock y vacía el carrito, cancelación que solo funciona en
  `pendiente`). No se repite end-to-end en esta fase porque no cambió
  ningún contrato de negocio — solo estados/responsive/a11y.
* **Flujo vendedor completo** (registro como vendedor → publicar con
  imágenes reordenadas → visible en catálogo → recibir pedido → moverlo
  por el kanban → comprador ve el nuevo estado al recargar): verificado en
  la Fase 3.7 (`b9516d7`/`719867d`) con `seller1`/`seller2`/`buyer3` reales:
  producto publicado con 3 imágenes reordenadas apareció en el catálogo
  con la portada correcta; `c…02` pasó de "Pendiente" a "Pagado" con un
  PATCH real confirmado en la base.
* **Reseña solo tras pedido `entregado`**: RLS
  (`reviews_insert_verified_purchase`, Fase 2.3) + UI (`canReview` en
  `useReviews`, Fase 3.5) verificados juntos en la Fase 3.5.
* **Transiciones inválidas del kanban rechazadas en el hook sin llegar al
  service**: reverificado en esta fase — "Pagado" → "Entregado" directo
  mostró el toast de rechazo y no generó ningún `PATCH` nuevo (inspección
  de `read_network_requests`, quedó en el mismo único `PATCH` de la
  transición válida anterior).
* `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.
* `grep -rl "@/lib/supabase" components hooks` devuelve vacío.
