-- MercadoTech — schema.sql
-- Copia de REFERENCIA generada a partir de supabase/migrations/. NO es la
-- fuente de verdad: la fuente de verdad son las migraciones individuales en
-- supabase/migrations/, aplicadas en orden por `supabase db reset`. Este
-- archivo existe para poder leer el esquema completo de un vistazo.
-- Generado: 2026-08-20 — Fase 2.2.

-- ============================================================
-- 20260819100000_enable_extensions.sql
-- ============================================================
-- Supabase ya trae pgcrypto habilitado por defecto en el proyecto, pero se
-- declara explícito e idempotente aquí para que `supabase db reset` no
-- dependa de configuración implícita del proyecto remoto.
-- Nota: gen_random_uuid() es nativo de PostgreSQL 13+ (no requiere pgcrypto),
-- pero se deja pgcrypto disponible por si alguna fase futura la necesita
-- (ej. hashing) sin otra migración de setup.
create extension if not exists "pgcrypto" with schema extensions;

-- ============================================================
-- 20260819100100_create_profiles.sql
-- ============================================================
-- PROFILES: 1:1 con auth.users. El id NO se genera aquí: es el mismo uuid
-- que auth.users.id (lo asigna el trigger handle_new_user de abajo).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SUPUESTO (spec no lo detalla): display_name inicial se toma de
-- raw_user_meta_data->>'display_name' si el signup lo mandó (ej. formulario
-- de registro de la sesión 3); si no vino, queda null y el usuario lo
-- completa después desde su perfil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Función utilitaria reusada por cualquier tabla con updated_at (products,
-- support_articles). Vive aquí, junto a la primera migración que la necesita,
-- para no crear un archivo de "utilidades" separado sin más contenido.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 20260819100200_create_categories.sql
-- ============================================================
-- CATEGORIES: árbol simple (parent_id nullable = raíz del árbol).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories (id),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- ============================================================
-- 20260819100300_create_products.sql
-- ============================================================
-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id),
  category_id uuid not null references public.categories (id),
  title text not null,
  description text,
  brand text,
  condition text not null default 'nuevo'
    check (condition in ('nuevo', 'usado', 'reacondicionado')),
  price numeric(12, 2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_seller_id_idx on public.products (seller_id);
create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);

-- ============================================================
-- 20260819100400_create_product_images.sql
-- ============================================================
-- PRODUCT_IMAGES: galería ordenable. "position" define el orden que el
-- drag & drop de la sesión 3 reescribe.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_path text not null,
  "position" integer not null default 0
);

alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images (product_id);

-- ============================================================
-- 20260819100500_create_cart_items.sql
-- ============================================================
-- CART_ITEMS: carrito persistente por usuario.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  -- Un producto aparece una sola vez por carrito: agregarlo de nuevo suma
  -- cantidad en vez de duplicar la fila (lo resuelve el service, no la DB).
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;

create index cart_items_user_id_idx on public.cart_items (user_id);

-- ============================================================
-- 20260819100600_create_orders.sql
-- ============================================================
-- ORDERS
-- SUPUESTO (spec no lo marca explícito para "total", solo dice "Precios > 0"
-- en las restricciones globales): se aplica el mismo criterio a total, ya
-- que create_order_from_cart siempre lo calcula como suma de price*quantity
-- de al menos un ítem, así que nunca debería ser <= 0.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  total numeric(12, 2) not null check (total > 0),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_buyer_id_idx on public.orders (buyer_id);

-- ============================================================
-- 20260819100700_create_order_items.sql
-- ============================================================
-- ORDER_ITEMS: snapshot de título y precio (histórico inmutable — si el
-- vendedor edita el producto después, el pedido ya facturado no cambia) y
-- seller_id denormalizado (permite que la política RLS del vendedor filtre
-- "sus" order_items sin tener que hacer join contra products en cada fila).
--
-- SUPUESTO (spec no especifica on delete para product_id): se deja sin
-- acción explícita (RESTRICT por defecto), a diferencia de order_id que sí
-- es cascade. Un producto con historial de pedidos no debe poder borrarse
-- físicamente — el soft-delete es is_active en products.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  seller_id uuid not null references public.profiles (id),
  title_snapshot text not null,
  price_snapshot numeric(12, 2) not null check (price_snapshot > 0),
  quantity integer not null check (quantity > 0)
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_id_idx on public.order_items (seller_id);

-- ============================================================
-- 20260819100800_create_questions.sql
-- ============================================================
-- QUESTIONS: preguntas y respuestas estilo Mercado Libre. answer/answered_at
-- nullable hasta que el vendedor responde.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);

-- ============================================================
-- 20260819100900_create_reviews.sql
-- ============================================================
-- REVIEWS: reseñas verificadas — order_id ancla la reseña a la compra que la
-- habilita (la Fase 2.3 exige, vía RLS, que ese pedido esté 'entregado' y
-- contenga el producto).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  order_id uuid not null references public.orders (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- Una reseña por comprador y producto (independiente de cuántas veces lo
  -- haya comprado).
  unique (product_id, buyer_id)
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews (product_id);

-- ============================================================
-- 20260819101000_create_favorites.sql
-- ============================================================
-- FAVORITES
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Un like/favorito único por (usuario, producto): evita duplicados por
  -- doble clic y simplifica el toggle en el frontend.
  unique (user_id, product_id)
);

alter table public.favorites enable row level security;

create index favorites_user_id_idx on public.favorites (user_id);

-- ============================================================
-- 20260819101100_create_product_views.sql
-- ============================================================
-- PRODUCT_VIEWS: cada apertura de un producto es un evento (sin contador
-- agregado — se cuenta con COUNT() cuando haga falta, ej. analítica del
-- vendedor).
--
-- SUPUESTO (spec no marca user_id como not null): se deja nullable para
-- permitir registrar vistas de visitantes no autenticados; el frontend
-- decide si las manda o no.
create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.profiles (id),
  viewed_at timestamptz not null default now()
);

alter table public.product_views enable row level security;

create index product_views_product_id_idx on public.product_views (product_id);

-- ============================================================
-- 20260819101200_create_support_articles.sql
-- ============================================================
-- SUPPORT_ARTICLES: base de conocimiento (FAQ). El contenido real lo llena
-- el seed (Fase 2.5); esta migración solo define la tabla. Se vectorizará
-- tal cual para el RAG de soporte de la sesión 4.
create table public.support_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_articles enable row level security;

create trigger set_support_articles_updated_at
  before update on public.support_articles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 20260819101300_create_support_tickets.sql
-- ============================================================
-- SUPPORT_TICKETS: usados por el agente de voz de la sesión 8 (channel
-- distingue si el ticket se originó por chat o por voz).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);

-- ============================================================
-- 20260819101400_create_ticket_messages.sql
-- ============================================================
-- TICKET_MESSAGES: sender_role distingue si el mensaje lo mandó el usuario,
-- el agente de IA ('agente') o un humano de soporte que tomó el caso
-- ('humano') — esta última opción anticipa escalamiento, no se usa hasta
-- que exista panel de soporte humano.
create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('usuario', 'agente', 'humano')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);

-- ============================================================
-- 20260819101500_create_order_from_cart_function.sql
-- ============================================================
-- create_order_from_cart: única vía para crear un pedido. orders/order_items
-- no aceptan insert directo del cliente (política de la Fase 2.3) — todo
-- pasa por aquí para garantizar que stock, snapshot y vaciado de carrito
-- ocurran de forma atómica.
--
-- SECURITY DEFINER porque valida y descuenta stock de productos de
-- CUALQUIER vendedor, algo que el comprador no tiene permiso de hacer
-- directamente vía RLS. La validación p_buyer_id = auth.uid() de abajo es
-- lo que evita que se abuse del privilegio elevado para vaciar el carrito
-- o generar pedidos de otro usuario.
create function public.create_order_from_cart(p_buyer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_item record;
begin
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'p_buyer_id no coincide con el usuario autenticado';
  end if;

  if not exists (select 1 from public.cart_items where user_id = p_buyer_id) then
    raise exception 'El carrito está vacío';
  end if;

  -- Paso 1: bloquear (for update) las filas de producto involucradas y
  -- validar disponibilidad + acumular el total, antes de escribir nada.
  -- El bloqueo se mantiene hasta el final de la transacción (el commit
  -- implícito al retornar), así que sigue vigente en el paso 3.
  for v_item in
    select
      ci.product_id,
      ci.quantity,
      p.title,
      p.price,
      p.stock,
      p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    order by ci.product_id
    for update of p
  loop
    if not v_item.is_active then
      raise exception 'El producto "%" ya no está disponible', v_item.title;
    end if;

    if v_item.stock < v_item.quantity then
      raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
        v_item.title, v_item.stock, v_item.quantity;
    end if;

    v_total := v_total + (v_item.price * v_item.quantity);
  end loop;

  -- Paso 2: crear el pedido con el total ya validado.
  insert into public.orders (buyer_id, status, total)
  values (p_buyer_id, 'pendiente', v_total)
  returning id into v_order_id;

  -- Paso 3: crear los order_items con snapshot, descontar stock y vaciar
  -- el carrito. Los productos siguen bloqueados desde el paso 1, así que el
  -- descuento de stock es seguro frente a otro checkout concurrente.
  for v_item in
    select
      ci.product_id,
      ci.quantity,
      p.title,
      p.price,
      p.seller_id
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    order by ci.product_id
  loop
    insert into public.order_items
      (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
    values
      (v_order_id, v_item.product_id, v_item.seller_id, v_item.title, v_item.price, v_item.quantity);

    update public.products
    set stock = stock - v_item.quantity
    where id = v_item.product_id;
  end loop;

  delete from public.cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_cart (uuid) from public;
revoke execute on function public.create_order_from_cart (uuid) from anon;
grant execute on function public.create_order_from_cart (uuid) to authenticated;

