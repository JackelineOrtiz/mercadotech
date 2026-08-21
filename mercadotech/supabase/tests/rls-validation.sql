-- ============================================================================
-- MercadoTech — supabase/tests/rls-validation.sql
-- ============================================================================
-- QA de seguridad de RLS: el objetivo de este archivo es romper las
-- políticas, no confirmar que funcionan. Se ejecuta con:
--   psql "$DB_URL" -f supabase/tests/rls-validation.sql
-- contra una base ya reseteada (supabase db reset), para tener el seed de
-- la Fase 2.5 intacto. Cada escenario simula un actor real con
-- `set local role` + `set local request.jwt.claims`, dentro de begin/rollback
-- para no ensuciar el seed. La única excepción a "no usar service role" es
-- preparar estado (marcada explícitamente como tal) — nunca para evaluar el
-- resultado de una prueba.
--
-- Derivación de escenarios: se leyeron las políticas REALES de
-- supabase/migrations/20260819110000_create_rls_policies.sql (no la spec) y
-- se compararon contra los 9 mínimos de la Fase 2.6. Los 9 están cubiertos
-- (algunos partidos en sub-incisos a/b/c); el resto (EXTRA-1..12) salió de
-- leer las políticas reales tabla por tabla y preguntarme "¿qué pasa si...".
--
-- Actores del seed (Fase 2.5) usados en este archivo:
--   buyer1  a0000000-0000-0000-0000-000000000001
--   buyer2  a0000000-0000-0000-0000-000000000002
--   buyer3  a0000000-0000-0000-0000-000000000003
--   seller1 a0000000-0000-0000-0000-000000000004  (dueño de products b...001-009)
--   seller2 a0000000-0000-0000-0000-000000000005  (dueño de products b...010-016)
--   admin1  a0000000-0000-0000-0000-000000000006
-- Pedidos: c...001 buyer1/entregado · c...002 buyer1/pendiente ·
--          c...003 buyer2/pagado · c...004 buyer2/enviado ·
--          c...005 buyer3/cancelado · c...006 buyer3/entregado
-- ============================================================================


-- ============================================================
-- ESCENARIO 1 — Anónimo: ve productos activos; NO ve carritos, pedidos ni
-- tickets.
-- ============================================================

-- ESPERADO 1a: >0 filas (catálogo público, hay 14 productos activos de 16).
\echo '--- 1a: anon ve productos activos ---'
begin;
set local role anon;
select count(*) from public.products where is_active = true;
rollback;

-- ESPERADO 1b: 0 filas (no ve los 2 productos inactivos, ni siquiera existen
-- para su USING).
\echo '--- 1b: anon NO ve productos inactivos ---'
begin;
set local role anon;
select count(*) from public.products where is_active = false;
rollback;

-- ESPERADO 1c: error de permiso (ni siquiera hay GRANT a anon en cart_items,
-- no llega a evaluarse RLS).
\echo '--- 1c: anon intenta leer cart_items (permission denied) ---'
begin;
set local role anon;
select count(*) from public.cart_items;
rollback;

-- ESPERADO 1d: error de permiso (mismo caso, orders solo tiene GRANT a
-- authenticated).
\echo '--- 1d: anon intenta leer orders (permission denied) ---'
begin;
set local role anon;
select count(*) from public.orders;
rollback;

-- ESPERADO 1e: error de permiso (support_tickets solo tiene GRANT a
-- authenticated).
\echo '--- 1e: anon intenta leer support_tickets (permission denied) ---'
begin;
set local role anon;
select count(*) from public.support_tickets;
rollback;


-- ============================================================
-- ESCENARIO 2 — Comprador: ve/edita SU carrito; no puede tocar el de otro.
-- ============================================================

-- ESPERADO 2a: INSERT 1, y el select posterior devuelve esa fila (buyer1 ve
-- su propio carrito recién creado).
\echo '--- 2a: buyer1 agrega y ve su propio cart_item ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 1);
select count(*) from public.cart_items where user_id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- Preparación de estado (superuser, sin RLS, marcada explícitamente): crea
-- un cart_item de buyer1 para que 2b/2c tengan algo que intentar tocar.
begin;
insert into public.cart_items (id, user_id, product_id, quantity)
values ('99999999-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 1);

-- ESPERADO 2b: UPDATE 0 (buyer2 no puede tocar el cart_item de buyer1).
\echo '--- 2b: buyer2 intenta editar el cart_item de buyer1 ---'
savepoint sp_2b;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.cart_items set quantity = 99 where id = '99999999-0000-0000-0000-000000000001';
rollback to savepoint sp_2b;

-- ESPERADO 2c: 0 filas (el cart_item de buyer1 no es visible para buyer2 al
-- hacer SELECT, ni siquiera para leerlo).
\echo '--- 2c: buyer2 no VE el cart_item de buyer1 ---'
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select count(*) from public.cart_items where id = '99999999-0000-0000-0000-000000000001';
rollback;


-- ============================================================
-- ESCENARIO 3 — Comprador: no puede insertar reseña sin pedido 'entregado';
-- sí con él.
-- ============================================================

-- ESPERADO 3a: error de RLS (reviews_insert_verified_purchase) — c...003 de
-- buyer2 está en 'pagado', no 'entregado'.
\echo '--- 3a: buyer2 intenta reseñar producto de un pedido NO entregado ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.reviews (product_id, buyer_id, order_id, rating, comment)
values ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 5, 'Intento inválido');
rollback;

-- Preparación de estado (superuser, sin RLS, marcada explícitamente): agrega
-- a la orden ENTREGADA c...001 de buyer1 un ítem de un producto que buyer1
-- todavía no reseñó (b...005), para poder probar el camino de éxito sin
-- tocar las reseñas ya sembradas.
begin;
insert into public.order_items (id, order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
values ('99999999-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'Procesador AMD Ryzen 5 5600X', 649.00, 1);

-- ESPERADO 3b: INSERT 1 (buyer1 sí compró b...005 en un pedido entregado).
\echo '--- 3b: buyer1 SI puede reseñar un producto de un pedido entregado ---'
savepoint sp_3b;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.reviews (product_id, buyer_id, order_id, rating, comment)
values ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 5, 'Excelente procesador, rinde muy bien.');
rollback to savepoint sp_3b;
rollback;


-- ============================================================
-- ESCENARIO 4 — Vendedor: CRUD de SUS productos; no puede editar productos
-- ajenos.
-- ============================================================

-- ESPERADO 4a: UPDATE 1 (seller1 edita su propio producto).
\echo '--- 4a: seller1 actualiza su propio producto ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
update public.products set price = 2099.00 where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO 4b: UPDATE 0 (seller2 no puede editar un producto de seller1).
\echo '--- 4b: seller2 intenta editar un producto de seller1 ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
update public.products set price = 1.00 where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO 4c: DELETE 0 (seller2 no puede borrar un producto de seller1).
\echo '--- 4c: seller2 intenta borrar un producto de seller1 ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
delete from public.products where id = 'b0000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO 4d: INSERT 1 (seller1 crea un producto propio nuevo).
\echo '--- 4d: seller1 inserta un producto nuevo propio ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
insert into public.products (seller_id, category_id, title, price, stock)
values ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Laptop de prueba', 999.00, 1);
rollback;

-- ESPERADO 4e: error de RLS (buyer1 no tiene role='seller').
\echo '--- 4e: buyer1 (no seller) intenta insertar un producto ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.products (seller_id, category_id, title, price, stock)
values ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Laptop de un buyer', 999.00, 1);
rollback;


-- ============================================================
-- ESCENARIO 5 — Vendedor: ve pedidos que contienen sus ítems; no ve pedidos
-- ajenos. (Este SELECT es justo el que disparaba la recursión infinita
-- encontrada en la Fase 2.5 — si corre sin error, el fix sigue vigente.)
-- ============================================================

-- ESPERADO 5a: 5 filas — c...001,002,004,005,006 (todos menos c...003, que
-- es 100% de seller2).
\echo '--- 5a: seller1 ve los pedidos con sus items (5, sin c...003) ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select count(*) as total, bool_or(id = 'c0000000-0000-0000-0000-000000000003') as ve_pedido_ajeno
from public.orders;
rollback;

-- ESPERADO 5b: 3 filas — c...001,003,006 (todos menos c...002,004,005, que
-- son 100% de seller1).
\echo '--- 5b: seller2 ve los pedidos con sus items (3, sin c...002/004/005) ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';
select count(*) as total,
  bool_or(id in ('c0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005')) as ve_pedido_ajeno
from public.orders;
rollback;


-- ============================================================
-- ESCENARIO 6 — Vendedor: puede responder preguntas SOLO de sus productos.
-- ============================================================

-- ESPERADO 6a: UPDATE 1 (seller1 responde una pregunta sobre SU producto
-- b...002).
\echo '--- 6a: seller1 responde pregunta de su propio producto ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
update public.questions set answer = 'Pesa aproximadamente 1.4 kg.', answered_at = now()
where id = '10000000-0000-0000-0000-000000000005';
rollback;

-- ESPERADO 6b: UPDATE 0 (la pregunta 10...007 es sobre b...014, producto de
-- seller2).
\echo '--- 6b: seller1 intenta responder pregunta de producto de seller2 ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
update public.questions set answer = 'Intento inválido', answered_at = now()
where id = '10000000-0000-0000-0000-000000000007';
rollback;

-- ESPERADO 6c: error de permiso (la columna "question" no está en el GRANT
-- de columnas de UPDATE, ni siquiera para el vendedor dueño del producto).
\echo '--- 6c: seller1 intenta editar el TEXTO de una pregunta de su producto ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
update public.questions set question = 'hackeado' where id = '10000000-0000-0000-0000-000000000005';
rollback;


-- ============================================================
-- ESCENARIO 7 — Usuario: no puede cambiar su propio role.
-- ============================================================

-- ESPERADO 7a: error de permiso (columna "role" no está en el GRANT de
-- columnas; ni siquiera llega al trigger protect_profiles_role).
\echo '--- 7a: buyer1 intenta auto-promoverse a admin ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO 7b: UPDATE 0 — profiles_update_own exige auth.uid() = id, así que
-- NI SIQUIERA el admin puede tocar la fila de otro usuario por este camino
-- (autenticado normal). Promover a alguien más requiere la service role
-- (admin.ts) — comportamiento esperado, documentado en la Fase 2.3, no un
-- bug de esta prueba.
\echo '--- 7b: admin1 intenta cambiar el role de buyer1 via UPDATE normal ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
update public.profiles set display_name = 'Hackeado por admin' where id = 'a0000000-0000-0000-0000-000000000001';
rollback;


-- ============================================================
-- ESCENARIO 8 — Admin: puede moderar (borrar pregunta/reseña, editar
-- support_articles).
-- ============================================================

-- ESPERADO 8a: DELETE 1 (admin borra una pregunta que no es suya).
\echo '--- 8a: admin borra una pregunta ajena ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
delete from public.questions where id = '10000000-0000-0000-0000-000000000006';
rollback;

-- ESPERADO 8b: DELETE 1 (admin borra una reseña que no es suya).
\echo '--- 8b: admin borra una reseña ajena ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
delete from public.reviews where id = '20000000-0000-0000-0000-000000000003';
rollback;

-- ESPERADO 8c: UPDATE 1 (admin edita un artículo de soporte).
\echo '--- 8c: admin edita un support_article ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
update public.support_articles set title = 'Tiempos de envío actualizados' where id = '50000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO 8d (negativo): DELETE 0 — buyer1 no es autor ni admin, no puede
-- borrar la pregunta 10...002 (la hizo buyer3).
\echo '--- 8d: buyer1 (no autor, no admin) intenta borrar pregunta ajena ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
delete from public.questions where id = '10000000-0000-0000-0000-000000000002';
rollback;


-- ============================================================
-- ESCENARIO 9 — Checkout: create_order_from_cart falla con carrito vacío y
-- con stock insuficiente; éxito descuenta stock y vacía carrito.
-- ============================================================

-- ESPERADO 9a: excepción "El carrito está vacío" (buyer2 no tiene
-- cart_items en el seed).
\echo '--- 9a: checkout con carrito vacio (buyer2) ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000002');
rollback;

-- Preparación de estado (buyer3 insertando en SU propio carrito, acción
-- normal permitida — no requiere service role): agrega al router con
-- stock 0 (b...008).
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000008', 1);

-- ESPERADO 9b: excepción nombrando el producto ("Stock insuficiente para
-- 'Router TP-Link Archer C6 AC1200'...").
\echo '--- 9b: checkout con stock insuficiente (buyer3, Router con stock 0) ---'
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000003');
rollback;

-- Preparación de estado (buyer3 insertando en SU propio carrito): agrega la
-- webcam (b...015, stock 11) en cantidad 1.
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';
insert into public.cart_items (user_id, product_id, quantity)
values ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000015', 1);

-- ESPERADO 9c: se devuelve un uuid (el pedido creado); stock de b...015 pasa
-- de 11 a 10; el carrito de buyer3 queda en 0 filas.
\echo '--- 9c: checkout exitoso (buyer3, webcam) ---'
select public.create_order_from_cart('a0000000-0000-0000-0000-000000000003') as pedido_creado;
select stock from public.products where id = 'b0000000-0000-0000-0000-000000000015';
select count(*) from public.cart_items where user_id = 'a0000000-0000-0000-0000-000000000003';
rollback;


-- ============================================================
-- EXTRA-1/2/3 — categories: solo admin escribe (derivado de leer
-- categories_insert_admin).
-- ============================================================

-- ESPERADO EXTRA-1: error de permiso (anon no tiene GRANT de insert en
-- categories).
\echo '--- EXTRA-1: anon intenta insertar una categoria ---'
begin;
set local role anon;
insert into public.categories (name, slug) values ('Hackeo', 'hackeo');
rollback;

-- ESPERADO EXTRA-2: error de RLS (buyer1 tiene GRANT de insert pero no
-- is_admin()).
\echo '--- EXTRA-2: buyer1 (no admin) intenta insertar una categoria ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.categories (name, slug) values ('Hackeo', 'hackeo');
rollback;

-- ESPERADO EXTRA-3: INSERT 1 (admin1 sí puede).
\echo '--- EXTRA-3: admin1 inserta una categoria nueva ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000006","role":"authenticated"}';
insert into public.categories (name, slug) values ('Domótica', 'domotica');
rollback;


-- ============================================================
-- EXTRA-4 — product_images: la visibilidad sigue al producto (derivado de
-- product_images_select_visible, que hace EXISTS contra products).
-- ============================================================

-- ESPERADO EXTRA-4: buyer1 ve 0 filas; seller1 (dueño) ve 2 — b...009 es un
-- producto INACTIVO de seller1.
\echo '--- EXTRA-4a: buyer1 NO ve imagenes de un producto inactivo ajeno ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select count(*) from public.product_images where product_id = 'b0000000-0000-0000-0000-000000000009';
rollback;

\echo '--- EXTRA-4b: seller1 SI ve las imagenes de su propio producto inactivo ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
select count(*) from public.product_images where product_id = 'b0000000-0000-0000-0000-000000000009';
rollback;


-- ============================================================
-- EXTRA-5/6/7 — orders UPDATE: casos borde de la política compuesta
-- (derivados de orders_update_seller_advance_or_buyer_cancel).
-- ============================================================

-- ESPERADO EXTRA-5: UPDATE 0 — c...003 de buyer2 está 'pagado', no
-- 'pendiente'; el USING de la rama compradora ya lo bloquea.
\echo '--- EXTRA-5: buyer2 intenta cancelar un pedido que no esta pendiente ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.orders set status = 'cancelado' where id = 'c0000000-0000-0000-0000-000000000003';
rollback;

-- ESPERADO EXTRA-6: UPDATE 1 — seller1 tiene items en c...004 (enviado),
-- puede avanzarlo a entregado.
\echo '--- EXTRA-6: seller1 avanza el status de un pedido con sus items ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';
update public.orders set status = 'entregado' where id = 'c0000000-0000-0000-0000-000000000004';
rollback;

-- ESPERADO EXTRA-7: error de RLS ("new row violates..."), no un UPDATE 0
-- silencioso — el USING SÍ deja pasar la fila (buyer1 es dueño de un pedido
-- 'pendiente'), pero el WITH CHECK la rechaza porque el único estado
-- resultante permitido para el comprador es 'cancelado', no 'entregado'.
-- Postgres distingue: fila no encontrada por USING => 0 filas silencioso;
-- fila encontrada pero el WITH CHECK rechaza el resultado => error duro.
\echo '--- EXTRA-7: buyer1 intenta marcar su propio pedido pendiente como entregado ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.orders set status = 'entregado' where id = 'c0000000-0000-0000-0000-000000000002';
rollback;


-- ============================================================
-- EXTRA-8 — favorites: no se puede suplantar a otro usuario (derivado de
-- favorites_insert_own).
-- ============================================================

-- ESPERADO EXTRA-8: error de RLS (auth.uid() de buyer1 no coincide con el
-- user_id que intenta forzar, el de buyer2).
\echo '--- EXTRA-8: buyer1 intenta insertar un favorito a nombre de buyer2 ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.favorites (user_id, product_id)
values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001');
rollback;


-- ============================================================
-- EXTRA-9 — product_views: GRANT existe pero RLS filtra a 0 filas (distinto
-- del caso 1c-1e, donde ni siquiera hay GRANT).
-- ============================================================

-- ESPERADO EXTRA-9: 0 filas, SIN error de permiso — buyer1 tiene GRANT de
-- select (es "authenticated") pero no es vendedor de ningún producto ni
-- admin, así que la política lo filtra todo.
\echo '--- EXTRA-9: buyer1 (sin productos propios) lee product_views ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select count(*) from public.product_views;
rollback;


-- ============================================================
-- EXTRA-10/11/12 — support_tickets / ticket_messages: aislamiento entre
-- usuarios y la restricción "solo cerrar".
-- ============================================================

-- ESPERADO EXTRA-10: 0 filas — buyer1 no tiene tickets propios (los del
-- seed son de buyer2 y buyer3).
\echo '--- EXTRA-10: buyer1 no ve tickets ajenos (no tiene ninguno propio) ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select count(*) from public.support_tickets;
rollback;

-- ESPERADO EXTRA-11: error de RLS al intentar 'resuelto' (mismo caso que
-- EXTRA-7: USING deja pasar la fila porque buyer2 es dueño, pero WITH CHECK
-- rechaza el resultado); UPDATE 1 al intentar 'cerrado' — el dueño solo
-- puede llegar a ese estado.
\echo '--- EXTRA-11a: buyer2 intenta marcar su ticket como resuelto (bloqueado) ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.support_tickets set status = 'resuelto' where id = '60000000-0000-0000-0000-000000000001';
rollback;

\echo '--- EXTRA-11b: buyer2 SI puede cerrar su propio ticket ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';
update public.support_tickets set status = 'cerrado' where id = '60000000-0000-0000-0000-000000000001';
rollback;

-- ESPERADO EXTRA-12: error de RLS — el ticket 60...001 es de buyer2, no de
-- buyer1.
\echo '--- EXTRA-12: buyer1 intenta insertar un mensaje en el ticket de buyer2 ---'
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.ticket_messages (ticket_id, sender_role, content)
values ('60000000-0000-0000-0000-000000000001', 'usuario', 'Mensaje inyectado');
rollback;
