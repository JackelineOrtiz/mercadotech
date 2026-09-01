# MercadoTech — Guía para Claude Code

Marketplace de productos tecnológicos con soporte por agentes de voz. Ver
`README.md` para el plan maestro del proyecto y el mapa de sesiones.

## Estado del proyecto

Sesión 1, Sesión 2 (Fases 2.1–2.7), Sesión 3 (Fases 3.0–3.8), Sesión 4
(Fases 4.0–4.8), Sesión 5 (Fases 5.0–5.6) y Sesión 6 (Fases 6.1–6.8)
completas y commiteadas — checkout transaccional, panel del vendedor con
drag & drop, pipeline RAG (pgvector + búsqueda semántica + asistentes),
gobernanza (4 Skills en `.claude/skills/` + servidor MCP de solo lectura
en `mcp/`), y red de pruebas (Vitest + Playwright + CI en GitHub Actions).
Sesión 7 en adelante (performance, secretos, deploy — SIN CI, ya está):
pendiente. Trabajo ad-hoc fuera del temario (pedido explícito del
usuario, no de una sesión): 404/error boundary, recuperación de
contraseña, "Mi perfil", storefront público del vendedor (`/tienda/
[sellerId]`, vista `public_profiles`) y panel de admin (`/admin`) — las
pantallas que le faltaban a la app para ser funcional más allá del PDF de
la spec. Detalle fase por fase, decisiones y deuda técnica vigente →
[`docs/BITACORA.md`](docs/BITACORA.md); checklist de responsive/a11y/
estados de la Sesión 3 → [`docs/SESION3_CHECKLIST.md`](docs/SESION3_CHECKLIST.md);
los 6 casos de prueba y la calibración del RAG → [`docs/RAG.md`](docs/RAG.md);
el ciclo de revisión de gobernanza → [`docs/REVISION_S5.md`](docs/REVISION_S5.md);
metodología y errores típicos de debugging → [`docs/DEBUGGING.md`](docs/DEBUGGING.md).

## Estructura del repositorio

- `README.md`, `MercadoTech_sesion*.md`: especificaciones de cada sesión del
  curso. Son la fuente de verdad de lo que hay que construir — léelas antes
  de generar código.
- `docs/`: documentación técnica generada durante el proyecto (arquitectura,
  bitácora, checklists).
- `mercadotech/`: el proyecto Next.js (se crea en la Fase 2.1); `mcp/`
  dentro de ahí es el servidor MCP (Sesión 5), paquete npm propio.
- `.claude/skills/`: 6 Skills de gobernanza — `mercadotech-architecture-
  enforcer` (gate previo a crear/mover archivos), `mercadotech-code-
  reviewer` (informe /10 después de escribir), `mercadotech-automatic-
  validator` (veredicto binario al cerrar una tarea — corre `npm run
  test` siempre, y `test:e2e` si `supabase status` está arriba),
  `mercadotech-tech-lead` (scorecard de diseño), `mercadotech-governance-
  orchestrator` (corre enforcer → reviewer → validator en una sola
  invocación y entrega el mensaje de commit listo — reemplaza invocar
  las 3 a mano), `mercadotech-ci-watch` (después de un `git push`, hace
  polling real de GitHub Actions y reporta el resultado real — verde con
  los jobs, o rojo con el log real del step que falló). Las 6 REPORTAN,
  nunca editan código. Norma del ciclo al cerrar cualquier feature:
  invocar `mercadotech-governance-orchestrator` (equivale a reviewer →
  correcciones → validator, en orden), y después del push,
  `mercadotech-ci-watch` para confirmar el CI real.

## Principio rector

Separación estricta de capas: `components/` (presentación pura) →
`hooks/` (estado de cliente) → `services/` (lógica de negocio, cliente
Supabase inyectable) → `lib/supabase/` (clientes) / `lib/ai/` (Hugging
Face: embeddings vía SDK, chat vía `fetch` al router OpenAI-compatible). La
UI nunca importa `lib/ai/`, `lib/voice/`, `services/*` ni
`@/lib/supabase/*` directamente desde `components/` u otro hook que no sea
el propio service — la IA solo se alcanza por hook → `fetch` a
`app/api/v1/*` → service → `lib/ai/`, porque el token de Hugging Face y el
cliente admin no pueden viajar al navegador. El cliente admin
(`lib/supabase/admin.ts`) solo se usa en Route Handlers (`app/api/v1/`) y
en `scripts/` (nunca importable desde ahí por el paquete `server-only` —
`scripts/index-all.ts` construye su propio cliente admin inline). Verificar
antes de cerrar cualquier fase de frontend:

```bash
grep -rl "@/lib/supabase\|@/lib/ai" components hooks   # debe devolver vacío
grep -rl "from \"@/services" components                # debe devolver vacío
grep -rl "@/lib/supabase/admin" app hooks services components | grep -v "^app/api/"  # debe devolver vacío
grep -rl "@/app\|@/components\|@/hooks" mcp/src         # debe devolver vacío
```

`mcp/` (Sesión 5) es un consumidor más de `services/` y `lib/ai/`: jamás
reimplementa lógica de negocio ni importa de `app/`, `components/` ni
`hooks/` — solo `services/`, `lib/ai/`, `lib/constants/` y `types/`. Sus
clientes Supabase se crean en `mcp/src/context.ts` (fábrica por llamada,
`{anon, admin}`), nunca importando `lib/supabase/admin.ts` — mismo motivo
que `scripts/`: `server-only` revienta bajo Node/tsx puro.

- `components/`: `ui/` (shadcn/Base UI genéricos), `shared/` (`Price`,
  `ProductImage`, `EmptyState`/`ErrorState`/`LoadingState`...), `layout/`
  (`Navbar`, `MobileNav`, `SellerSidebar`...), `catalog/`, `product/`,
  `cart/`, `orders/`, `seller/` (CRUD + drag & drop), `auth/`.
- Rutas: `(shop)` público/comprador (`/`, `/buscar`, `/categoria/[slug]`,
  `/producto/[id]`, `/favoritos`, `/carrito`, `/pedidos`, `/pedidos/[id]`,
  `/perfil`, `/tienda/[sellerId]`); `(seller)` bajo el prefijo
  `/vendedor/...` para no colisionar con `/pedidos` del comprador;
  `(admin)` bajo `/admin/...` (guard estricto `role === 'admin'`, sin el
  bypass "or admin" de `(seller)`); `(auth)` (`/login`, `/register`,
  `/recuperar`, `/actualizar-contrasena`).
- `lib/constants/`: `roles.ts` (enums de dominio), `catalog.ts`
  (paginación/orden), `orders.ts` (`ORDER_STATUS_FLOW` y labels/badges),
  `product.ts` (límites de título e imágenes), `ai.ts` (TODOS los
  tunables del pipeline RAG — modelos, dimensiones, top K, thresholds,
  presupuesto de contexto — cada uno con el porqué en su comentario; nunca
  hardcodear un tunable de IA fuera de aquí).
- `lib/ai/`: `embeddings.ts`, `completion.ts`, `prompts.ts`,
  `context-builder.ts` (funciones puras, sin red ni Supabase). `app/api/v1/`:
  `reindex`, `search/semantic`, `chat` — los 3 únicos Route Handlers del
  proyecto. `components/chat/`: UI del asistente, consumida solo por
  `/asistente` y `/soporte`.

## Convenciones aprendidas en la Sesión 3

- Service: función async, cliente Supabase inyectable como ÚLTIMO
  parámetro con default `createClient()` — `getX(id, supabase = createClient())`.
- `numeric(12,2)` de Postgres llega como `string` desde PostgREST: el
  service lo convierte con `Number()` (o `formatPrice` en `lib/utils.ts`
  para mostrarlo); los componentes siempre reciben `number`.
- Los componentes reciben `image_url` ya resuelta (pública), nunca el
  `image_path` crudo — lo resuelve `storage.service.getPublicUrl`.
- Los filtros de catálogo viven en la URL (`searchParams`), no en estado
  local, para poder compartir/recargar con los mismos filtros.
- Las transiciones del kanban de pedidos del vendedor se validan en el
  HOOK (`useSellerOrders`), no en el service ni en RLS: la política de
  `orders` deja que el vendedor ponga cualquier estado en un pedido con
  ítems suyos, sin validar secuencia ni excluir "cancelado".

## Convenciones aprendidas en la Sesión 6

- Tests unitarios junto al archivo que prueban (`cart.service.ts` ↔
  `cart.service.test.ts`), E2E en `e2e/`. Los tests unitarios inyectan el
  cliente Supabase por parámetro — jamás `vi.mock` de `lib/supabase/*`;
  `lib/ai/*` sí se mockea por módulo (única excepción, no tiene cliente
  inyectable). Cada test se ancla al comportamiento REAL del código (leer
  el archivo antes de escribir su test), nunca a lo que la spec asume.
- `data-testid` en kebab-case con prefijo de dominio (`cart-checkout`,
  `kanban-column-pagado`) — únicos atributos que un cambio de test puede
  agregar a un componente existente.

## Comandos

Todos se corren desde `mercadotech/` (el proyecto Next.js), no desde la raíz
del repo.

```bash
cd mercadotech

npm run dev          # servidor de desarrollo (http://localhost:3000)
npm run build        # build de producción
npm run start        # sirve el build de producción
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest (lógica pura + services, sin red)
npm run test:coverage # ídem + reporte de cobertura en coverage/
npm run test:e2e     # Playwright — requiere `supabase db reset` antes
npm run db:types     # regenera types/database.ts desde la BD local
npx tsx scripts/index-all.ts   # indexa productos activos + artículos
                                # publicados en knowledge_embeddings
                                # (requiere HUGGINGFACEHUB_API_TOKEN)
```

Antes de correr `npm run dev`, copiar `.env.example` a `.env.local` y llenar
las credenciales de Supabase.

### Supabase local (requiere Docker corriendo)

```bash
cd mercadotech

supabase start      # levanta Postgres + Studio + Auth + Storage locales
supabase db reset   # reconstruye la BD desde cero: migraciones + seed
supabase stop        # apaga los contenedores
```

`supabase start` imprime las credenciales locales (`API_URL`, `ANON_KEY`,
`SERVICE_ROLE_KEY`, etc.) — son las que van en `.env.local` para desarrollar
contra la base local en vez del proyecto de Supabase en la nube.

### CI (GitHub Actions, Sesión 6)

`.github/workflows/ci.yml` corre en cada push/PR: job `checks` (lint +
type-check + `test:coverage` + type-check de `mcp/`, sin Docker) y job
`e2e` (Supabase efímero + Playwright en Chromium). Cero secretos. El
campo `packageManager` de `package.json` está pineado a la versión REAL
de npm que generó `package-lock.json` en este entorno (`npm@10.8.2`) —
no se toca a la ligera: cambiarlo sin regenerar el lockfile con esa misma
versión reproduce el error "Missing from lock file" en CI (ver
`docs/DEBUGGING.md`).

### Servidor MCP (`mcp/`, Sesión 5)

```bash
cd mercadotech/mcp

npm run dev          # tsx watch src/index.ts
npm run build        # tsup → dist/index.js
npm run type-check   # tsc --noEmit
```

Inspeccionar sin Claude Code (pineado a 0.15.0 por Node 20, ver
`mcp/README.md`): `npx @modelcontextprotocol/inspector@0.15.0 npx tsx
mcp/src/index.ts` (desde `mercadotech/`).
