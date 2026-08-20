-- MercadoTech — policies.sql
-- Copia de REFERENCIA de las políticas RLS. NO es la fuente de verdad: la
-- fuente de verdad es la migración supabase/migrations/20260819110000_create_rls_policies.sql.
-- Generado: 2026-08-20 — Fase 2.3.

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
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id and oi.seller_id = (select auth.uid())
    )
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
    exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id and oi.seller_id = (select auth.uid())
    )
    or ((select auth.uid()) = buyer_id and status = 'pendiente')
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id and oi.seller_id = (select auth.uid())
    )
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
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = (select auth.uid())
    )
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
