# Arquitectura de MercadoTech

Documento de referencia para cualquier desarrollador que se une al proyecto.
Describe lo que existe hoy en el repositorio al cierre de la Sesión 2
(infraestructura: proyecto Next.js, base de datos, RLS, Storage, seed y
validación). No hay pantallas, hooks de negocio ni endpoints todavía — eso
empieza en la Sesión 3.

## Tabla de contenidos

1. [Arquitectura general y capas](#1-arquitectura-general-y-capas)
2. [Organización de carpetas](#2-organización-de-carpetas)
3. [Modelo relacional](#3-modelo-relacional)
4. [Decisiones de diseño](#4-decisiones-de-diseño)
5. [Integración Next.js ↔ Supabase](#5-integración-nextjs--supabase)
6. [Flujo de autenticación](#6-flujo-de-autenticación)
7. [Estrategia de escalabilidad](#7-estrategia-de-escalabilidad)
8. [Políticas RLS por tabla](#8-políticas-rls-por-tabla)
9. [Qué sigue](#9-qué-sigue)

---

## 1. Arquitectura general y capas

MercadoTech es un monolito Next.js 15 (App Router) sobre Supabase
(Postgres + Auth + Storage). No hay un backend separado: Supabase **es** el
backend, y Next.js habla con él directamente desde el navegador (protegido
por RLS) o desde el servidor cuando la operación no puede exponerse al
cliente (secretos, service role).

La regla que organiza todo el código de negocio (a construirse desde la
Sesión 3) es una cadena de una sola dirección:

```
components/  →  hooks/  →  services/  →  lib/supabase/  →  Postgres (RLS)
(presentación)  (estado)    (lógica)      (clientes)
```

- **`components/`** es presentación pura: recibe props, no hace fetching, no
  sabe que Supabase existe.
- **`hooks/`** maneja estado de cliente (loading, error, datos) llamando a
  `services/`. No tiene lógica de negocio propia.
- **`services/`** tiene la lógica de negocio real. Cada función acepta un
  `SupabaseClient` **inyectable** — por defecto el cliente de navegador —
  para que los mismos services se puedan llamar desde un Route Handler (con
  el cliente de servidor) o desde un test (con un cliente mockeado), sin
  duplicar lógica.
- **`lib/supabase/`** son los únicos archivos que saben construir un
  cliente de Supabase (ver [§5](#5-integración-nextjs--supabase)).
- **`app/api/v1/`** son Route Handlers delgados, reservados para lo que
  estructuralmente no puede correr en el navegador: secretos de proveedores
  de IA (Sesión 4), el cliente `admin` (service role), cookies de sesión en
  contextos que el cliente no puede tocar. **No** es una API REST paralela
  de propósito general — la lección de ReadHub fue exactamente construir
  una capa así y que el frontend nunca la llamara.

Dos capas adicionales, hoy vacías, con una regla fija: **la UI nunca las
importa directamente**.

- **`lib/ai/`** (Sesión 4): únicos archivos que conocen la API del
  proveedor de embeddings/chat.
- **`lib/voice/`** (Sesión 8): únicos archivos que conocen la Web Speech
  API / proveedor de voz.

## 2. Organización de carpetas

```
mercadotech/
├── app/
│   ├── (auth)/          login, registro (Sesión 3) — vacío hoy
│   ├── (shop)/          catálogo, producto, carrito, pedidos (Sesión 3) — vacío hoy
│   ├── (seller)/        panel del vendedor (Sesión 3) — vacío hoy
│   └── api/v1/          Route Handlers server-only — vacío hoy
├── components/          presentación pura — vacío hoy
├── hooks/                estado de cliente — vacío hoy
├── services/              lógica de negocio, cliente inyectable — vacío hoy
├── lib/
│   ├── supabase/           client.ts · server.ts · middleware.ts · admin.ts
│   ├── constants/            roles.ts (roles y estados, único tunable de esta fase)
│   ├── validators/             vacío — validación framework-agnóstica (Sesión 3+)
│   ├── ai/                       vacío — Sesión 4
│   ├── voice/                      vacío — Sesión 8
│   └── utils.ts                     helper cn() de shadcn/ui
├── types/                vacío — tipos de dominio + database.ts generado (Sesión 3)
├── middleware.ts         raíz, usa lib/supabase/middleware.ts
├── components.json       config de shadcn/ui (sin componentes instalados aún)
├── .env.example
└── supabase/
    ├── migrations/       16 migraciones, fuente de verdad del esquema
    ├── schema.sql        copia de referencia (NO fuente de verdad)
    ├── policies.sql      copia de referencia (NO fuente de verdad)
    ├── seed.sql          datos de prueba
    └── tests/
        └── rls-validation.sql
```

**Nota de desviación:** la spec original ubicaba `docs/` dentro de
`mercadotech/`. En este repo, `docs/` (y este mismo archivo) vive un nivel
arriba, junto a `README.md`, `CLAUDE.md` y las specs de cada sesión —
separa la documentación del *proyecto de curso* de la documentación técnica
del *código*, pero cumple la misma función. Gana lo construido: este es el
lugar real.

## 3. Modelo relacional

14 tablas en `public`, todas con RLS habilitado. `profiles` es 1:1 con
`auth.users` (gestionada por Supabase Auth, fuera de nuestro control
directo). El DDL completo y versionado está en `supabase/migrations/`;
`supabase/schema.sql` es la copia de lectura rápida.

**Nota de desviación:** la spec de la Fase 2.2 dice "15 entidades" en su
texto de contexto, pero su propia sección `### Entidades` solo define 14 —
son las 14 que existen en el código. No falta ninguna; es una
inconsistencia de conteo en la spec, no una omisión de la implementación.

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "mismo id"
    PROFILES ||--o{ PRODUCTS : vende
    CATEGORIES ||--o{ PRODUCTS : clasifica
    CATEGORIES ||--o{ CATEGORIES : "categoria padre"
    PRODUCTS ||--o{ PRODUCT_IMAGES : tiene
    PROFILES ||--o{ CART_ITEMS : posee
    PRODUCTS ||--o{ CART_ITEMS : "esta en"
    PROFILES ||--o{ ORDERS : compra
    ORDERS ||--o{ ORDER_ITEMS : contiene
    PRODUCTS ||--o{ ORDER_ITEMS : "vendido en"
    PROFILES ||--o{ ORDER_ITEMS : "vendedor de"
    PRODUCTS ||--o{ QUESTIONS : recibe
    PROFILES ||--o{ QUESTIONS : pregunta
    PRODUCTS ||--o{ REVIEWS : recibe
    PROFILES ||--o{ REVIEWS : escribe
    ORDERS ||--o{ REVIEWS : verifica
    PROFILES ||--o{ FAVORITES : marca
    PRODUCTS ||--o{ FAVORITES : "es marcado"
    PRODUCTS ||--o{ PRODUCT_VIEWS : "es visto"
    PROFILES ||--o{ PRODUCT_VIEWS : ve
    PROFILES ||--o{ SUPPORT_TICKETS : abre
    SUPPORT_TICKETS ||--o{ TICKET_MESSAGES : contiene

    AUTH_USERS {
        uuid id PK
        text email
    }
    PROFILES {
        uuid id PK "= auth.users.id"
        text display_name
        text role "buyer / seller / admin"
        text phone
        text avatar_path
    }
    CATEGORIES {
        uuid id PK
        text name UK
        text slug UK
        uuid parent_id FK
    }
    PRODUCTS {
        uuid id PK
        uuid seller_id FK
        uuid category_id FK
        text title
        text condition
        numeric price
        int stock
        bool is_active
    }
    PRODUCT_IMAGES {
        uuid id PK
        uuid product_id FK
        text image_path
        int position
    }
    CART_ITEMS {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        int quantity
    }
    ORDERS {
        uuid id PK
        uuid buyer_id FK
        text status "5 estados"
        numeric total
    }
    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        uuid seller_id FK "denormalizado"
        text title_snapshot
        numeric price_snapshot
        int quantity
    }
    QUESTIONS {
        uuid id PK
        uuid product_id FK
        uuid user_id FK
        text question
        text answer
    }
    REVIEWS {
        uuid id PK
        uuid product_id FK
        uuid buyer_id FK
        uuid order_id FK "verifica compra"
        int rating "1-5"
        text comment
    }
    FAVORITES {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
    }
    PRODUCT_VIEWS {
        uuid id PK
        uuid product_id FK
        uuid user_id FK "nullable"
        timestamptz viewed_at
    }
    SUPPORT_ARTICLES {
        uuid id PK
        text title
        text content
        text category
        bool is_published
    }
    SUPPORT_TICKETS {
        uuid id PK
        uuid user_id FK
        text subject
        text status "4 estados"
        text channel
    }
    TICKET_MESSAGES {
        uuid id PK
        uuid ticket_id FK
        text sender_role
        text content
    }
```

`SUPPORT_ARTICLES` no tiene relaciones — es contenido plano, base de
conocimiento para el RAG de soporte (Sesión 4).

Referencia SQL completa: [`supabase/schema.sql`](../mercadotech/supabase/schema.sql).

## 4. Decisiones de diseño

**Snapshots en `order_items` (`title_snapshot`, `price_snapshot`).**
Un pedido es un documento histórico: si el vendedor cambia el precio o el
título del producto después, el pedido ya facturado no debe cambiar. Sin
snapshot, el precio mostrado en "mis pedidos" cambiaría retroactivamente
cada vez que el vendedor edita su catálogo.

**`seller_id` denormalizado en `order_items`.**
Podría derivarse con un `join` a `products`, pero la política RLS del
vendedor ("ver ítems donde soy el vendedor") se ejecuta en *cada* fila de
*cada* consulta a `order_items`. Denormalizar evita un `join` extra en el
plan de RLS y, más importante, evita una segunda dependencia circular con
`products` (ya hay una entre `orders` y `order_items`, ver más abajo).

**Checkout como función transaccional (`create_order_from_cart`).**
Crear un pedido no es un solo `insert`: hay que leer el carrito, bloquear
stock, validar disponibilidad, crear la orden, crear los `order_items` con
snapshot, descontar stock y vaciar el carrito — todo o nada. Se implementó
como una función Postgres `SECURITY DEFINER` (bloqueo `for update` sobre
`products` para evitar carreras entre dos checkouts concurrentes) en lugar
de una serie de llamadas desde el cliente, porque desde el cliente no hay
forma de garantizar atomicidad entre pasos. Es además el **único** camino
de escritura a `orders`/`order_items`: ninguna política RLS permite
`insert` directo ahí.

**`product_views` como eventos, no como contador.**
Cada apertura de producto inserta una fila en vez de incrementar un
`view_count` en `products`. Un contador simple no permite responder
"¿cuándo?", "¿quién?" ni analítica temporal, y un `update` por cada vista
compite por el lock de la fila del producto con operaciones más
importantes (compra, edición de stock). Un evento es *append-only*: nunca
bloquea nada.

**Funciones `SECURITY DEFINER` como única forma de evitar recursión de RLS
entre tablas que se referencian mutuamente.**
`orders` necesita saber si el usuario es vendedor de alguno de sus
`order_items`; `order_items` necesita saber si el usuario es el comprador
del `order` al que pertenece. Escribir eso como un `exists (select ...)`
directo contra la otra tabla entra en recursión infinita: RLS se reevalúa
en cada acceso a una tabla sin importar la profundidad, así que
`orders → order_items → orders → ...` nunca termina (Postgres lo reporta
como `infinite recursion detected in policy`). Se resolvió con dos
funciones ayudantes (`is_order_buyer()`, `is_order_seller()`) `SECURITY
DEFINER`: al correr con los privilegios del dueño de la tabla, su consulta
interna no vuelve a pasar por RLS, y el ciclo se rompe. Mismo patrón usa
`is_admin()` para que la política de `profiles` no necesite leer
`profiles` con RLS activo para saber si el usuario es admin.

**Columnas protegidas con `GRANT` de columna, no solo con políticas.**
RLS filtra *filas*, no *columnas*. Para que un usuario pueda editar su
perfil pero no su propio `role` (o que un vendedor pueda responder una
pregunta pero no reescribirla), no alcanza con una política — se usa
`grant update (columnas_permitidas) on tabla to authenticated` en vez de
`grant update on tabla`. `profiles.role` además lleva un trigger
(`protect_profiles_role`) como defensa en profundidad, por si un cambio
futuro de `GRANT` reabre la columna sin querer.

## 5. Integración Next.js ↔ Supabase

Cuatro clientes en `lib/supabase/`, cada uno para un contexto distinto:

| Cliente | Archivo | Contexto | Auth |
|---|---|---|---|
| Browser | `client.ts` | Client Components | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, respeta RLS |
| Server | `server.ts` | Server Components / Server Actions | cookies de sesión (`next/headers`), respeta RLS |
| Middleware | `middleware.ts` | el `middleware.ts` raíz | refresca el token de sesión en cada request |
| Admin | `admin.ts` | Route Handlers server-only | `SUPABASE_SERVICE_ROLE_KEY`, **bypasea RLS** |

`admin.ts` importa `server-only` (el build de Next.js falla si algún
Client Component llega a importarlo, directa o indirectamente) y lleva un
comentario de advertencia en el propio archivo. Es el único cliente que no
respeta RLS — su uso debe justificarse caso por caso (ej. una operación
administrativa que ningún usuario autenticado debería poder hacer ni con
sus propios permisos elevados).

No hay una capa REST propia: todo el acceso a datos pasa por la Data API
de Supabase (PostgREST) usando alguno de estos cuatro clientes, con RLS
como única autoridad de qué fila puede tocar cada quien. `app/api/v1/`
existe para las excepciones explícitas de la Sesión 1 (secretos de IA,
cliente admin, lógica que necesita cookies fuera del alcance de un Server
Component) — no para duplicar lo que la Data API ya resuelve.

## 6. Flujo de autenticación

1. **Login/signup** (Sesión 3): llama a Supabase Auth desde el cliente de
   navegador. Auth crea la fila en `auth.users`.
2. **Trigger `handle_new_user`** (`SECURITY DEFINER`, disparado por Postgres
   al insertar en `auth.users`) crea automáticamente el `profile`
   correspondiente, con `role = 'buyer'` por defecto. Ningún código de
   aplicación crea perfiles manualmente.
3. **Sesión persistida en cookies.** Supabase Auth guarda el access/refresh
   token en cookies httpOnly. `middleware.ts` (raíz) llama a
   `lib/supabase/middleware.ts` en cada request que no sea un asset
   estático: reconstruye el cliente de Supabase desde las cookies de la
   request, llama a `auth.getUser()` (esto refresca el token si venció) y
   reescribe las cookies en la respuesta. Sin este paso, una sesión
   expirada silenciosamente dejaría de funcionar en vez de refrescarse.
4. **Server Components** leen la sesión ya refrescada vía `server.ts`
   (cookies de solo lectura en ese contexto — por eso el refresco activo
   vive en el middleware, no ahí).
5. **Cada request a Postgres lleva el JWT del usuario.** RLS lo lee con
   `auth.uid()` / `auth.role()` — no existe un concepto de sesión del lado
   de la base de datos separado del JWT de la request.

## 7. Estrategia de escalabilidad

- **RLS como única fuente de autorización.** No hay una capa de permisos
  paralela en la aplicación que pueda desincronizarse de la base de datos:
  aunque un bug de frontend intente leer o escribir algo indebido, Postgres
  lo bloquea igual.
- **Cliente Supabase inyectable en cada `service`** (a partir de la Sesión
  3): la misma función de negocio corre en el navegador, en un Route
  Handler o en un test con un mock, sin tres implementaciones separadas.
- **Denormalización puntual y justificada** (`seller_id` en `order_items`,
  snapshots en lugar de joins históricos) en vez de normalizar todo y pagar
  el costo en cada lectura RLS — normalizar de más es tan caro como
  denormalizar de más si el resultado es una política RLS con tres `join`
  implícitos en cada fila.
- **Funciones `SECURITY DEFINER` acotadas y auditables** en vez de abrir
  RLS de más para evitar recursión: cada una hace una sola cosa
  (`is_admin`, `is_order_buyer`, `is_order_seller`) y su alcance es
  auditable leyendo su cuerpo de ~5 líneas.
- **Migraciones reproducibles desde cero** (`supabase db reset` aplica las
  16 migraciones + seed sin intervención manual): cualquier entorno nuevo
  (CI, un ambiente de staging, la laptop de otro desarrollador) parte del
  mismo estado exacto.
- **Índices en toda columna usada por una política RLS o un filtro de
  catálogo** (`seller_id`, `category_id`, `is_active`, `buyer_id`, y
  equivalentes en las demás tablas) — sin ellos, cada política con
  `exists (...)` degrada a un table scan a medida que crecen los datos.
- **Capa de IA/voz aisladas detrás de `lib/ai/` y `lib/voice/`**: cuando
  cambie el proveedor (Sesión 4/8) o el modelo, el cambio queda contenido
  en un archivo, sin tocar `services/` ni componentes.

## 8. Políticas RLS por tabla

Regla general en todas: `(select auth.uid())` en vez de `auth.uid()` a
secas, para que Postgres lo evalúe una sola vez por sentencia. Referencia
SQL completa: [`supabase/policies.sql`](../mercadotech/supabase/policies.sql)
(RLS de tablas + Storage).

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | El dueño ve su perfil; el admin ve cualquiera. | Nadie por este camino — lo crea el trigger de signup. | El dueño edita su perfil, pero no puede cambiarse el rol a sí mismo. | Nadie — borrar un perfil rompería el historial de pedidos/reseñas. |
| `categories` | El catálogo de categorías es público. | Solo un admin da de alta categorías. | Solo un admin. | Solo un admin. |
| `products` | Público si está activo; el vendedor también ve los suyos inactivos. | Un vendedor publica productos a su propio nombre. | Solo el vendedor dueño edita su producto. | Solo el vendedor dueño lo retira. |
| `product_images` | Las mismas reglas de visibilidad que el producto al que pertenecen. | Solo el vendedor dueño del producto sube imágenes. | Solo el vendedor dueño. | Solo el vendedor dueño. |
| `cart_items` | Cada quien ve solo su propio carrito. | Cada quien agrega solo a su propio carrito. | Cada quien edita solo su propio carrito. | Cada quien vacía solo su propio carrito. |
| `orders` | El comprador ve sus pedidos; el vendedor ve los pedidos que incluyen algo suyo; el admin ve todos. | Nadie inserta directo — solo existe vía el checkout transaccional. | El vendedor puede avanzar el estado de un pedido con ítems suyos; el comprador solo puede cancelar mientras siga "pendiente". | Nadie — un pedido se cancela, no se borra. |
| `order_items` | El comprador del pedido, el vendedor de esos ítems, o el admin. | Nadie — solo el checkout transaccional. | Nadie — es un registro histórico inmutable. | Nadie, por la misma razón. |
| `questions` | Las preguntas de un producto son públicas. | Cualquier usuario autenticado pregunta a su propio nombre. | Solo el vendedor dueño del producto, y solo puede escribir la respuesta (no el texto de la pregunta). | El autor de la pregunta, o un admin. |
| `reviews` | Las reseñas son públicas. | Solo quien compró el producto **y** ese pedido ya está "entregado". | Solo el autor de la reseña. | El autor, o un admin. |
| `favorites` | Cada quien ve solo sus favoritos. | Cada quien marca a su propio nombre. | — (se quita y se vuelve a poner, no se edita). | Cada quien borra solo sus propios favoritos. |
| `product_views` | El vendedor ve las vistas de sus propios productos; el admin ve todas. | Cualquier usuario autenticado registra su propia vista. | — | — |
| `support_articles` | Los artículos publicados son públicos. | Solo un admin publica contenido de ayuda. | Solo un admin. | Solo un admin. |
| `support_tickets` | El dueño del ticket, o un admin. | Cada quien abre tickets a su propio nombre. | El dueño solo puede cerrarlo; el admin puede tocar cualquier campo. | — (un ticket se cierra, no se borra). |
| `ticket_messages` | El dueño del ticket, o un admin. | El dueño del ticket, o un admin. | — (un mensaje enviado es inmutable). | — |

**Storage** (`product-images`, `avatars`, ambos de lectura pública, máx. 5 MB,
solo JPEG/PNG/WEBP): cada usuario escribe y borra únicamente dentro de su
propia carpeta raíz (`{uid}/...`); en `product-images` además se exige
`role = 'seller'`. Detalle completo en
[`supabase/policies.sql`](../mercadotech/supabase/policies.sql).

## 9. Qué sigue

- **Sesión 3** — todas las pantallas (catálogo, producto, carrito, panel
  del vendedor), los `hooks`/`services` reales, y el drag & drop de galería
  de imágenes y kanban de pedidos.
- **Sesión 4** — `pgvector`, embeddings de los `support_articles`
  existentes, búsqueda semántica y el asistente de compras/soporte.
- **Sesión 8** — agente de voz de soporte sobre `lib/voice/`, usando
  `support_tickets`/`ticket_messages` como backend de conversación.
