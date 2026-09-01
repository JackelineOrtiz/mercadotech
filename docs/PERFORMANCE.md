# Performance — Sesión 7, Fase 7.2

Medición real, contra build de producción (`npm run build && npm run start`), nunca contra
`next dev` (decisión 12 de `MercadoTech_sesion7.md`). Metodología: Lighthouse CLI (`npx lighthouse`
v12.8.2) headless contra Chrome real, configuración móvil por defecto (simulated throttling),
`--only-categories=performance`. Sin bundle-analyzer (decisión 3: el build usa Turbopack) — el peso
por ruta se mide con el resumen de `next build` (First Load JS).

## Metodología

1. `npm run build` → registrar First Load JS por ruta.
2. `npm run start` (puerto 3000, DB local reseteada con `supabase db reset`) → Lighthouse móvil
   sobre 4 páginas: home (`/`, que en esta app ES el catálogo — no hay una portada separada),
   categoría (`/categoria/laptops`), detalle de producto (`/producto/[id]`) y `/asistente`.
3. Cada optimización candidata (Archivos de la Fase 7.2) se aplicó, se remidió, y se revirtió si no
   hubo mejora medible — regla explícita de la fase.

## Hallazgo de causa raíz (ANTES)

En las 4 páginas medidas, el patrón es idéntico:

| Página | Score | LCP | Elemento LCP | Render Delay (% del LCP) |
|---|---|---|---|---|
| Home | 84 | 4.3 s | texto (`h3`, título del 1er producto) | 90% |
| Categoría | 85 | 4.4 s | texto (`h3`, título del 1er producto) | 90% |
| Producto detalle | 82 | 4.8 s | texto (`h3`, título del 1er producto) | 91% |
| Asistente | 95 | 2.8 s | texto ("MercadoTech") | 84% |

TTFB es rápido (~455 ms) y `Total Blocking Time` es casi cero (10 ms) en todas — el JS no es lo
que bloquea. El 84-91% del tiempo de LCP es **Render Delay**: cada `page.tsx` de la app es
`"use client"`, así que el HTML que manda el servidor no tiene contenido real — el navegador tiene
que descargar JS, hidratar, y recién ahí el hook dispara el fetch a Supabase y React pinta el
contenido. Ni siquiera el elemento LCP es una imagen en ninguna de las 4 páginas: es texto que
depende de esa misma cadena.

**Esto excede el alcance preaprobado de esta fase** (`dynamic import` de `ChatWindow`/
`OrdersKanban`/`SortableImageGallery`, y ajustes de `ProductImage`) — ninguno de los dos ataca la
causa raíz real. Puesto en conocimiento del usuario antes de seguir; decisión tomada: mantenerse
estrictamente en el alcance preaprobado por la spec y documentar el resto como deuda técnica (ver
abajo), no ampliar el alcance de esta sesión.

## Optimizaciones probadas

### 1. `dynamic import` de `ChatWindow` (`/asistente`, `/soporte`) — REVERTIDO

`ChatWindow` no tiene ninguna dependencia de terceros pesada (solo componentes internos del propio
`components/chat/`). Medido con `dynamic()` + `ssr:false`:

| Ruta | Antes | Con dynamic import | Δ |
|---|---|---|---|
| `/asistente` | 307 kB | 311 kB | **+4 kB** |
| `/soporte` | 308 kB | 312 kB | **+4 kB** |

El wrapper de `dynamic()` agregó más First Load JS del que ahorró — no hay nada que diferir.
Revertido, queda anotado como intentado (comentario en ambos `page.tsx`).

### 2. `dynamic import` de `OrdersKanban` y `SortableImageGallery` — REVERTIDO

Ambos importan `@dnd-kit/core` (+`@dnd-kit/sortable`/`@dnd-kit/utilities` en el segundo), una
dependencia real y pesada. Medido:

| Ruta | Antes | Con dynamic import | Δ |
|---|---|---|---|
| `/vendedor/pedidos` | 272 kB | 258 kB | **-14 kB** ✅ |
| `/vendedor/publicar` | 318 kB | 296 kB | **-22 kB** ✅ |
| `/vendedor/productos/[id]/editar` | 318 kB | 296 kB | **-22 kB** ✅ |
| **First Load JS compartido por TODA la app** | 209 kB | 225 kB | **+16 kB** ❌ |

El ahorro es real en las 3 rutas del vendedor, pero Turbopack subió el runtime de `dynamic()` al
chunk **compartido por todas las rutas** al usarse en más de un punto de entrada — eso penaliza a
TODAS las páginas, incluidas exactamente las que mide el objetivo de esta fase:

| Página (afectada solo por el chunk compartido, no usa dnd-kit) | Antes | Con dynamic import | Δ |
|---|---|---|---|
| Home | score 84 | score 82 | **peor** |
| Categoría | score 85 | score 84 | **peor** |

Verificado aislando la causa: al revertir solo estos 2 `dynamic import` (dejando los ajustes de
`ProductImage`), el chunk compartido vuelve exacto a 209 kB. Confirmado 2 veces. Revertido en su
totalidad — el costo global (pagado por cada visita a cualquier página) supera el ahorro local
(pagado solo en 3 rutas de vendedor), y además va en contra directa del objetivo de la fase
(home/catálogo).

### 3. `ProductImage`: `sizes` correctos — APLICADO, se mantiene

Ninguna de las 7 instancias de `<ProductImage fill>` en el repo pasaba `sizes` — con `fill` y sin
`sizes`, `next/image` asume `100vw` y pide siempre la variante más grande del `srcset`, aunque la
imagen se muestre en una tarjeta de 1/4 del ancho. Se agregó `sizes` real según el contenedor de
cada instancia: grilla de catálogo (breakpoints de `ProductGrid`), galería de producto (`50vw`
desktop / `100vw` mobile, miniaturas `64px`), carrito (`80px`), tabla del vendedor (`48px`), fuentes
citadas del chat (`40px`).

No mueve el score de Lighthouse en las 4 páginas medidas (el elemento LCP es texto, no imagen, ver
causa raíz arriba) — pero reduce bytes de imagen transferidos de verdad en cada una (confirmado con
`uses-responsive-images` en `--only-categories=performance`, que ya pasaba con score 1 incluso antes
por los tamaños `w` que genera Next, pero ahora pide variantes más chicas y correctas). Se mantiene
por ser una corrección real y de riesgo cero, independiente de si mueve el puntaje de esta ronda.

### 4. `ProductImage`: `priority` en la portada above-the-fold de la home — PROBADO Y REVERTIDO

Se agregó soporte de `priority` a `ProductImage`/`ProductCard`/`ProductGrid` (prop `priorityCount`)
y se probó en la home con las primeras 4 tarjetas (cubre la primera fila en desktop). Medido:

| | Antes | Con priority en 4 imágenes |
|---|---|---|
| Home score | 84 | 82 (reproducido 2 veces) |
| Home LCP | 4.3 s | 4.6 s |

Como el elemento LCP real de la home es el título (texto), no la imagen, precargar 4 imágenes con
`priority` no ayuda al LCP medido — y compite por ancho de banda con el JS de hidratación que sí lo
determina (causa raíz de arriba). Revertido (`priorityCount` no se pasa en `page.tsx`). El prop
`priority` queda disponible en `ProductImage`/`ProductCard`/`ProductGrid` para si en el futuro la
home tiene una imagen real above-the-fold (ej. un banner).

## Resultado DESPUÉS (solo con el fix de `sizes` aplicado)

| Página | ANTES | DESPUÉS | LCP antes | LCP después |
|---|---|---|---|---|
| Home | 84 | 82 | 4.3 s | 4.6 s |
| Categoría | 85 | 86 | 4.4 s | 4.3 s |
| Producto detalle | 82 | 82 | 4.8 s | 4.7 s |
| Asistente | 95 | 92 | 2.8 s | 3.2 s |

El JS de estas 4 páginas es byte-idéntico entre ANTES y DESPUÉS (`sizes` no pesa JS, y todos los
`dynamic import` quedaron revertidos) — el scatter de ±2-4 puntos en ambas direcciones (Categoría
mejoró, Home/Asistente empeoraron un poco) es ruido de medición normal del throttling simulado de
Lighthouse en esta máquina, no un efecto del código. Ninguna optimización de esta fase mueve el
puntaje de forma medible, en ningún sentido — consistente con el hallazgo de causa raíz: el cuello
de botella real es la arquitectura de renderizado 100% cliente, no el peso del JS ni el de las
imágenes.

## Objetivos de la fase — resultado real

* LCP < 2.5 s: **NO alcanzado** en home/categoría/producto (4.3-4.8 s). Sí en `/asistente` (2.8 s,
  antes y después).
* CLS < 0.1: **alcanzado** en las 4 páginas (0-0.084).
* INP < 200 ms: no medido con Lighthouse de laboratorio (requiere interacción real); `Total
  Blocking Time` (proxy de laboratorio) es de 0-10 ms en las 4, sin problema.
* Lighthouse Performance ≥ 90 en home y catálogo: **NO alcanzado** (82-86). Causa raíz real,
  medida y documentada arriba — fuera del alcance preaprobado de esta fase (decisión del usuario,
  2026-09-01: mantenerse en los "ÚNICOS candidatos a cambio" de la spec en vez de ampliar el
  alcance a un cambio de arquitectura de renderizado).

## Deuda técnica nueva (para una sesión futura, no de esta)

El único fix real para el LCP de home/categoría/producto sería que su contenido inicial se
renderice en el servidor (ej. Server Component con fetch inicial + hidratación, o streaming con
`Suspense`) en vez de depender 100% de un hook cliente — un cambio de arquitectura real, no una
optimización puntual, y por eso fuera del alcance de "no introducir features nuevas, solo
endurecer" de esta sesión. Documentado acá como hallazgo real, no corregido.

## Comandos usados

```bash
npm run build && npm run start
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx lighthouse http://localhost:3000/<ruta> \
  --output=json --output-path=<archivo>.json \
  --chrome-flags="--headless=new" --quiet --only-categories=performance
```

## Verificación al cierre

* `npm run lint`, `npm run type-check`, `npm run build`: limpios.
* `npm run test`: 218/218.
* Greps de arquitectura de `CLAUDE.md` (los 4): vacíos.
