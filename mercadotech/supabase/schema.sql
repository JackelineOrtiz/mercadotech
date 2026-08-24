-- MercadoTech — schema.sql
-- Copia de REFERENCIA generada a partir de supabase/migrations/. NO es la
-- fuente de verdad: la fuente de verdad son las migraciones individuales en
-- supabase/migrations/, aplicadas en orden por `supabase db reset`. Este
-- archivo existe para poder leer el esquema completo de un vistazo.
-- Generado: 2026-08-24 — Fase 3.3 (agrega handle_new_user_metadata).

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

-- ============================================================
-- 20260819110000_create_rls_policies.sql
-- ============================================================
-- Políticas RLS para las 14 tablas de la Fase 2.2. Todas ya tienen RLS
-- habilitado (sin políticas) desde su migración de creación — hoy todo
-- estaba denegado por defecto. Esta migración agrega: función helper
-- is_admin(), protección de profiles.role, las políticas SELECT/INSERT/
-- UPDATE/DELETE de la tabla de la spec, y los GRANTs de la Data API.
--
-- Convención en todas las políticas: (select auth.uid()) en vez de
-- auth.uid() a secas — el envoltorio en subconsulta hace que Postgres lo
-- evalúe como InitPlan una sola vez por sentencia, no una vez por fila.

grant usage on schema public to anon, authenticated;

-- ============================================================
-- Helper: is_admin()
-- ============================================================
-- SECURITY DEFINER: corre con los privilegios del dueño de la función
-- (postgres, dueño de las tablas), así que su lectura a profiles NO pasa
-- por la política RLS de profiles (evita la recursión de "para saber si
-- puedo leer profiles, primero tengo que leer profiles"). search_path fijo
-- evita que alguien inyecte una tabla "profiles" falsa en otro esquema.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Helpers: is_order_buyer() / is_order_seller()
-- ------------------------------------------------------------
-- orders y order_items se necesitan verificar MUTUAMENTE (orders_select
-- mira si el usuario tiene ítems como vendedor; order_items_select mira si
-- el usuario es el comprador del pedido). Escribir eso como un EXISTS
-- directo contra la otra tabla causa recursión infinita: RLS se reevalúa en
-- CADA acceso a una tabla, sin importar cuán anidado esté, así que
-- orders -> order_items -> orders -> order_items... nunca termina
-- (Postgres lo reporta como "infinite recursion detected in policy").
-- SECURITY DEFINER rompe el ciclo: la consulta interna corre como dueño de
-- la tabla y no vuelve a pasar por RLS.
create function public.is_order_buyer(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.buyer_id = (select auth.uid())
  );
$$;

create function public.is_order_seller(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and oi.seller_id = (select auth.uid())
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
-- SELECT: dueño y admin.
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using ((select auth.uid()) = id or public.is_admin());

-- INSERT: sin política — el único camino es el trigger handle_new_user
-- (Fase 2.2), que corre SECURITY DEFINER como dueño de la tabla y por lo
-- tanto no necesita (ni pasa por) una política de INSERT. Un INSERT directo
-- del cliente queda denegado por defecto.

-- UPDATE: solo el dueño. La protección de la columna "role" no puede
-- expresarse en una política (RLS es por fila, no por columna): se resuelve
-- abajo con GRANT de columnas + un trigger dedicado.
create policy "profiles_update_own" on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Un usuario autenticado normal solo puede tocar estas columnas de su
-- propio perfil — "role" queda fuera a propósito (ver trigger de abajo).
grant select on public.profiles to authenticated;
grant update (display_name, phone, avatar_path) on public.profiles to authenticated;

-- DELETE: sin política — nadie borra perfiles vía cliente (no está en la
-- spec; borrar un perfil rompería el historial de pedidos/reseñas).

-- Defensa en profundidad para "role": aunque un futuro cambio de GRANT
-- volviera a exponer la columna, este trigger sigue bloqueando el cambio
-- salvo que sea un admin o una conexión sin contexto de usuario (scripts
-- de servidor con la service role — auth.role() no devuelve 'authenticated'
-- ni 'anon' ahí, y is_admin() da false porque auth.uid() es null).
create function public.protect_profiles_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'No tienes permiso para cambiar tu rol';
  end if;
  return new;
end;
$$;

create trigger protect_profiles_role
  before update on public.profiles
  for each row execute function public.protect_profiles_role();

-- ============================================================
-- CATEGORIES
-- ============================================================
-- SELECT: todos, incluido anon (catálogo público).
create policy "categories_select_all" on public.categories
  for select
  using (true);

create policy "categories_insert_admin" on public.categories
  for insert
  with check (public.is_admin());

create policy "categories_update_admin" on public.categories
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_delete_admin" on public.categories
  for delete
  using (public.is_admin());

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- ============================================================
-- PRODUCTS
-- ============================================================
-- SELECT: público si is_active; el vendedor ve también sus propios
-- inactivos. La spec no menciona "y admin" aquí (a diferencia de profiles),
-- así que no se agrega bypass de admin — moderación de productos ajenos
-- queda para el cliente con service role, no para este camino RLS.
create policy "products_select_active_or_own" on public.products
  for select
  using (is_active or (select auth.uid()) = seller_id);

-- INSERT: authenticated con seller_id = auth.uid() Y rol 'seller' (un buyer
-- no puede crear productos aunque intente forzar el seller_id).
create policy "products_insert_own_as_seller" on public.products
  for insert
  with check (
    (select auth.uid()) = seller_id
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'seller'
    )
  );

create policy "products_update_own" on public.products
  for update
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy "products_delete_own" on public.products
  for delete
  using ((select auth.uid()) = seller_id);

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- ============================================================
-- PRODUCT_IMAGES
-- ============================================================
-- SELECT: mismas condiciones de visibilidad que el producto dueño.
create policy "product_images_select_visible" on public.product_images
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.is_active or p.seller_id = (select auth.uid()))
    )
  );

create policy "product_images_insert_own_product" on public.product_images
  for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = (select auth.uid())
    )
  );

create policy "product_images_update_own_product" on public.product_images
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = (select auth.uid())
    )
  );

create policy "product_images_delete_own_product" on public.product_images
  for delete
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.seller_id = (select auth.uid())
    )
  );

grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

-- ============================================================
-- CART_ITEMS
-- ============================================================
-- Los compradores solo ven y editan SU propio carrito.
create policy "cart_items_select_own" on public.cart_items
  for select
  using ((select auth.uid()) = user_id);

create policy "cart_items_insert_own" on public.cart_items
  for insert
  with check ((select auth.uid()) = user_id);

create policy "cart_items_update_own" on public.cart_items
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cart_items_delete_own" on public.cart_items
  for delete
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.cart_items to authenticated;

-- ============================================================
-- ORDERS
-- ============================================================
-- SELECT: comprador dueño, vendedor con ítems en el pedido, o admin.
create policy "orders_select_buyer_seller_or_admin" on public.orders
  for select
  using (
    (select auth.uid()) = buyer_id
    or public.is_order_seller(orders.id)
    or public.is_admin()
  );

-- INSERT: sin política — la única vía es create_order_from_cart() (Fase
-- 2.2), SECURITY DEFINER, que escribe como dueño de la tabla y por lo tanto
-- no depende de (ni le afecta) esta ausencia de política. Un INSERT directo
-- del cliente queda denegado.

-- UPDATE: una sola política que empareja cada actor con su propio
-- USING/WITH CHECK — con dos políticas permisivas separadas, Postgres
-- combina los WITH CHECK con OR entre sí, lo que dejaría "colarse" el
-- check de un actor usando el using del otro.
-- Vendedor: puede tocar pedidos donde tenga ítems, en cualquier estado
-- (avanzar el status). No se valida aquí la secuencia exacta de estados
-- ("pendiente" -> "pagado" -> ...) porque la spec no la define — es una
-- regla de flujo de negocio para el service layer de la sesión 3, no de
-- autorización.
-- Comprador: solo puede tocar SU pedido si sigue 'pendiente', y el único
-- resultado permitido es dejarlo 'cancelado'.
create policy "orders_update_seller_advance_or_buyer_cancel" on public.orders
  for update
  using (
    public.is_order_seller(orders.id)
    or ((select auth.uid()) = buyer_id and status = 'pendiente')
    or public.is_admin()
  )
  with check (
    public.is_order_seller(orders.id)
    or ((select auth.uid()) = buyer_id and status = 'cancelado')
    or public.is_admin()
  );

-- DELETE: sin política — un pedido nunca se borra, se cancela (status).

grant select, update on public.orders to authenticated;

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
create policy "order_items_select_buyer_seller_or_admin" on public.order_items
  for select
  using (
    public.is_order_buyer(order_items.order_id)
    or seller_id = (select auth.uid())
    or public.is_admin()
  );

-- INSERT/UPDATE/DELETE: sin políticas — order_items es un snapshot
-- histórico inmutable (Fase 2.2); solo create_order_from_cart() escribe
-- aquí, con los mismos privilegios de dueño de tabla que en orders.

grant select on public.order_items to authenticated;

-- ============================================================
-- QUESTIONS
-- ============================================================
-- SELECT: todos (el producto y sus preguntas son públicos).
create policy "questions_select_all" on public.questions
  for select
  using (true);

create policy "questions_insert_own" on public.questions
  for insert
  with check ((select auth.uid()) = user_id);

-- UPDATE: solo el vendedor dueño del producto, y solo puede escribir
-- answer/answered_at (ver GRANT de columnas abajo) — no la pregunta ni el
-- autor.
create policy "questions_update_answer_by_seller" on public.questions
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = questions.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = questions.product_id and p.seller_id = (select auth.uid())
    )
  );

create policy "questions_delete_own_or_admin" on public.questions
  for delete
  using ((select auth.uid()) = user_id or public.is_admin());

grant select on public.questions to anon, authenticated;
grant insert, delete on public.questions to authenticated;
grant update (answer, answered_at) on public.questions to authenticated;

-- ============================================================
-- REVIEWS
-- ============================================================
create policy "reviews_select_all" on public.reviews
  for select
  using (true);

-- INSERT: solo quien compró el producto Y el pedido ya está 'entregado'.
-- El EXISTS cubre las dos condiciones en una sola subconsulta (orders +
-- order_items), tal como pide la spec.
create policy "reviews_insert_verified_purchase" on public.reviews
  for insert
  with check (
    (select auth.uid()) = buyer_id
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = reviews.order_id
        and o.buyer_id = (select auth.uid())
        and o.status = 'entregado'
        and oi.product_id = reviews.product_id
    )
  );

create policy "reviews_update_own" on public.reviews
  for update
  using ((select auth.uid()) = buyer_id)
  with check ((select auth.uid()) = buyer_id);

create policy "reviews_delete_own_or_admin" on public.reviews
  for delete
  using ((select auth.uid()) = buyer_id or public.is_admin());

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

-- ============================================================
-- FAVORITES
-- ============================================================
create policy "favorites_select_own" on public.favorites
  for select
  using ((select auth.uid()) = user_id);

create policy "favorites_insert_own" on public.favorites
  for insert
  with check ((select auth.uid()) = user_id);

-- UPDATE: sin política — un favorito no se edita, se quita y se vuelve a
-- poner (toggle).

create policy "favorites_delete_own" on public.favorites
  for delete
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.favorites to authenticated;

-- ============================================================
-- PRODUCT_VIEWS
-- ============================================================
-- SELECT: el vendedor del producto (analítica de su catálogo) o admin —
-- ni siquiera quien generó la vista puede leer su propio historial aquí
-- (no lo pide la spec).
create policy "product_views_select_seller_or_admin" on public.product_views
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_views.product_id and p.seller_id = (select auth.uid())
    )
    or public.is_admin()
  );

-- INSERT: solo authenticated (no anon), y siempre a nombre de quien está
-- logueado. user_id quedó nullable en el esquema (Fase 2.2) pensando en
-- tracking anónimo futuro, pero ese camino tendría que ir por un Route
-- Handler con service role — no por esta política, que exige
-- user_id = auth.uid().
create policy "product_views_insert_own" on public.product_views
  for insert
  with check ((select auth.uid()) = user_id);

-- UPDATE/DELETE: sin políticas — un evento de vista no se edita ni se borra.

grant select, insert on public.product_views to authenticated;

-- ============================================================
-- SUPPORT_ARTICLES
-- ============================================================
create policy "support_articles_select_published" on public.support_articles
  for select
  using (is_published);

create policy "support_articles_insert_admin" on public.support_articles
  for insert
  with check (public.is_admin());

create policy "support_articles_update_admin" on public.support_articles
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "support_articles_delete_admin" on public.support_articles
  for delete
  using (public.is_admin());

grant select on public.support_articles to anon, authenticated;
grant insert, update, delete on public.support_articles to authenticated;

-- ============================================================
-- SUPPORT_TICKETS
-- ============================================================
create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "support_tickets_insert_own" on public.support_tickets
  for insert
  with check ((select auth.uid()) = user_id);

-- UPDATE: el dueño solo puede cerrarlo (status -> 'cerrado'); el admin
-- puede tocar cualquier campo/estado. Una sola política, misma razón que en
-- orders: evita que el WITH CHECK de un actor se combine con el USING del
-- otro.
create policy "support_tickets_update_owner_close_or_admin" on public.support_tickets
  for update
  using ((select auth.uid()) = user_id or public.is_admin())
  with check (
    ((select auth.uid()) = user_id and status = 'cerrado')
    or public.is_admin()
  );

-- DELETE: sin política — un ticket se cierra, no se borra.

grant select, insert, update on public.support_tickets to authenticated;

-- ============================================================
-- TICKET_MESSAGES
-- ============================================================
create policy "ticket_messages_select_own_ticket_or_admin" on public.ticket_messages
  for select
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id and t.user_id = (select auth.uid())
    )
    or public.is_admin()
  );

-- INSERT: dueño del ticket o admin. No se restringe aquí sender_role: la
-- spec no lo pide, y el mensaje 'agente' (IA de soporte) lo escribirá un
-- camino de servidor propio en la sesión 4/8, no este INSERT de cliente.
create policy "ticket_messages_insert_own_ticket_or_admin" on public.ticket_messages
  for insert
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_messages.ticket_id and t.user_id = (select auth.uid())
    )
    or public.is_admin()
  );

-- UPDATE/DELETE: sin políticas — un mensaje de soporte es inmutable una
-- vez enviado.

grant select, insert on public.ticket_messages to authenticated;

-- ============================================================
-- 20260819120000_create_storage_buckets.sql
-- ============================================================
-- Storage: buckets product-images y avatars, ambos de lectura pública.
-- storage.objects ya trae RLS habilitado y GRANTs base a anon/authenticated
-- desde la instalación de la extensión Storage — a diferencia del esquema
-- public que armamos nosotros, aquí NO hace falta otorgar GRANTs de tabla:
-- el control de acceso vive enteramente en las políticas de abajo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- ============================================================
-- PRODUCT-IMAGES — path: {seller_id}/{product_id}/{n}.{ext}
-- ============================================================
-- SELECT: además de servir por la URL pública (bucket public=true, que no
-- pasa por RLS), se deja una política explícita para que .list()/.download()
-- por la API autenticada también funcionen — el flag "public" del bucket
-- solo cubre el endpoint /object/public/..., no las demás rutas de la API.
create policy "product_images_objects_select_public" on storage.objects
  for select
  using (bucket_id = 'product-images');

-- INSERT: carpeta propia (primer segmento del path = auth.uid()) Y rol
-- 'seller' — refuerza a nivel Storage la misma regla que products_insert
-- (Fase 2.3): un buyer no debería poder acumular archivos en un bucket que
-- es, por diseño, solo para vendedores.
create policy "product_images_objects_insert_own_seller_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'seller'
    )
  );

-- DELETE: solo carpeta propia. Sin el check de rol — si alguien deja de ser
-- vendedor, debe poder seguir borrando lo que ya subió.
create policy "product_images_objects_delete_own_folder" on storage.objects
  for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

-- Sin política de UPDATE: el flujo del vendedor es subir y borrar: para
-- "reemplazar" una imagen se sube una nueva y se borra la vieja (o se hace
-- upsert sobre el mismo path, que Storage resuelve como create+overwrite,
-- no como un UPDATE de fila vía SQL).

-- ============================================================
-- AVATARS — path: {user_id}/...
-- ============================================================
create policy "avatars_objects_select_public" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- INSERT/DELETE: cualquier usuario autenticado (buyer/seller/admin, todos
-- tienen avatar) dentro de su propia carpeta. DELETE no lo pedía la spec
-- explícita, pero sin él un usuario no podría quitar su avatar actual antes
-- de subir uno nuevo con otro nombre de archivo — se agrega por consistencia
-- con product-images.
create policy "avatars_objects_insert_own_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

create policy "avatars_objects_delete_own_folder" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

-- Sin política de UPDATE, misma razón que product-images.

-- ============================================================
-- 20260824100000_handle_new_user_metadata.sql
-- ============================================================
-- Sesión 3, Fase 3.3: registrarse como vendedor era imposible. La función
-- handle_new_user original (Fase 2.2, 20260819100100_create_profiles.sql)
-- inserta el profile sin leer "role" de ningún lado, así que la fila
-- siempre nace con el default de la columna ('buyer'). Y como el trigger
-- protect_profiles_role (Fase 2.3, 20260819110000_create_rls_policies.sql)
-- bloquea que un usuario cambie su propio role después de creado, el INSERT
-- de este trigger es el ÚNICO momento en TODO el sistema donde el role de
-- un signup normal puede fijarse a algo distinto de 'buyer' — de ahí que
-- esta migración reemplace la función en vez de tocarla desde afuera.
--
-- No se edita la migración original de la Fase 2.2 (regla de la sesión):
-- se reemplaza la función completa con CREATE OR REPLACE en un archivo
-- nuevo. El trigger on_auth_user_created (Fase 2.2) sigue apuntando a
-- public.handle_new_user() por nombre, así que no hace falta tocarlo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    -- Blindaje contra manipulación del cliente: cualquier valor que no sea
    -- exactamente 'buyer' o 'seller' (incluido 'admin', vacío, o ausente)
    -- cae a 'buyer'. No hay forma de registrarse como admin.
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;

