# MercadoTech — Guía para Claude Code

Marketplace de productos tecnológicos con soporte por agentes de voz. Ver
`README.md` para el plan maestro del proyecto y el mapa de sesiones.

## Estado

- Sesión 1: repo inicializado.
- Sesión 2, Fase 2.1: proyecto Next.js 15 + estructura de carpetas + clientes
  de Supabase creados.
- Sesión 2, Fase 2.2: 14 tablas + trigger `handle_new_user` + función
  `create_order_from_cart` + índices, vía migraciones en
  `mercadotech/supabase/migrations/`.
- Sesión 2, Fase 2.3: políticas RLS de las 14 tablas + `is_admin()` +
  protección de `profiles.role` + GRANTs de la Data API. Verificado con
  pruebas funcionales reales (self-promotion bloqueada, cross-seller
  bloqueado, catálogo público visible para `anon`, insert directo a
  `orders`/`categories` bloqueado).
- Sesión 2, Fase 2.4: buckets `product-images` y `avatars` (lectura
  pública, 5 MB máx, solo JPEG/PNG/WEBP) con políticas de escritura/borrado
  por carpeta propia. Verificado con subidas HTTP reales contra la Storage
  API local (no solo SQL): carpeta ajena bloqueada, rol no-seller bloqueado,
  MIME no permitido bloqueado, lectura pública sin auth funciona.
- Sesión 2, Fase 2.5: `supabase/seed.sql` — 6 usuarios, 8 categorías, 16
  productos, pedidos en los 5 estados, preguntas, reseñas, favoritos,
  vistas, 10 artículos FAQ y 2 tickets. Verificado con login real (Auth API)
  de los 6 usuarios y un checkout completo (cart → RPC → stock → orden) vía
  REST. En el camino se corrigieron dos bugs reales encontrados al probar
  contra la API real (no solo SQL): faltaba `auth.identities` para poder
  hacer login, y **recursión infinita** entre las políticas de `orders` y
  `order_items` (Fase 2.3) — se resolvió con funciones `is_order_buyer()` /
  `is_order_seller()` SECURITY DEFINER, mismo patrón que `is_admin()`.

## Estructura del repositorio

- `README.md`, `MercadoTech_sesion*.md`: especificaciones de cada sesión del
  curso. Son la fuente de verdad de lo que hay que construir — léelas antes
  de generar código.
- `docs/`: documentación técnica generada durante el proyecto (arquitectura,
  decisiones de diseño).
- `mercadotech/`: el proyecto Next.js (se crea en la Fase 2.1).

## Principio rector

Separación estricta de capas: `components/` (presentación pura) →
`hooks/` (estado de cliente) → `services/` (lógica de negocio, cliente
Supabase inyectable) → `lib/supabase/` (clientes). La UI nunca importa
`lib/ai/`, `lib/voice/` ni el cliente `admin`. Ver el detalle completo en
`README.md`.

## Comandos

Todos se corren desde `mercadotech/` (el proyecto Next.js), no desde la raíz
del repo.

```bash
cd mercadotech

npm run dev        # servidor de desarrollo (http://localhost:3000)
npm run build      # build de producción
npm run start      # sirve el build de producción
npm run lint       # ESLint
npx tsc --noEmit   # chequeo de tipos sin emitir archivos
```

Antes de correr `npm run dev`, copiar `.env.example` a `.env.local` y llenar
las credenciales de Supabase.

### Supabase local (requiere Docker corriendo)

```bash
cd mercadotech

supabase start      # levanta Postgres + Studio + Auth + Storage locales
supabase db reset   # reconstruye la BD desde cero: migraciones (+ seed cuando exista)
supabase stop        # apaga los contenedores
```

`supabase start` imprime las credenciales locales (`API_URL`, `ANON_KEY`,
`SERVICE_ROLE_KEY`, etc.) — son las que van en `.env.local` para desarrollar
contra la base local en vez del proyecto de Supabase en la nube.
