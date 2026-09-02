-- ============================================================================
-- MercadoTech — seed.sql
-- ============================================================================
-- Se ejecuta automáticamente después de las migraciones en `supabase db
-- reset`. Corre como el rol `postgres` (dueño de las tablas), así que NO
-- pasa por RLS — pero los datos se diseñaron para ser coherentes con las
-- políticas de la Fase 2.3 de todas formas (ej. las reseñas solo referencian
-- pedidos 'entregado' que sí contienen el producto reseñado), para que este
-- dataset sirva tal cual en pruebas manuales, en los tests E2E de la sesión 6
-- y como fixture realista para el RAG de la sesión 4.
--
-- Contraseña común de laboratorio para los 6 usuarios: MercadoTech123!
-- (hasheada con bcrypt vía pgcrypto — crypt(text, gen_salt('bf')) — al
-- momento de insertar, igual que lo hace GoTrue en un signup real).
--
-- Convención de UUIDs fijos por prefijo del primer grupo (todo hex válido):
--   a0000000-... usuarios/profiles      f0000000-... order_items
--   b0000000-... products               10000000-... questions
--   c0000000-... orders                 20000000-... reviews
--   d0000000-... categories             30000000-... favorites
--   e0000000-... product_images         40000000-... product_views
--                                       50000000-... support_articles
--                                       60000000-... support_tickets
--                                       70000000-... ticket_messages
-- ============================================================================

-- ============================================================
-- USUARIOS (auth.users + profiles vía trigger handle_new_user)
-- ============================================================
-- El trigger crea el profile automáticamente con role='buyer' (default) y
-- display_name desde raw_user_meta_data. Los roles de seller/admin se
-- corrigen después con UPDATE — coalesce(auth.role(),'service_role') en
-- protect_profiles_role (Fase 2.3) permite el cambio porque este script
-- corre sin contexto de JWT.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'buyer1@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"María Fernanda Quispe"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'buyer2@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Jorge Luis Ramírez"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'buyer3@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Ana Lucía Torres"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'seller1@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"TecnoStore Perú"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'seller2@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Gamer Zone Perú"}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'admin1@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Admin MercadoTech"}', '', '', '', '');

-- GoTrue (Supabase Auth) exige una identidad en auth.identities para poder
-- iniciar sesión con email/password — sin esto, el login real falla con un
-- error 500 opaco ("Database error querying schema") aunque auth.users
-- tenga la fila y el hash de la contraseña sea correcto. provider_id usa el
-- propio uid como texto, igual que lo hace un signup real por email.
insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u
where u.id in (
  'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006'
);

update public.profiles set role = 'seller', phone = '+51 987 654 321', avatar_path = 'avatars/a0000000-0000-0000-0000-000000000004/avatar.jpg' where id = 'a0000000-0000-0000-0000-000000000004';
update public.profiles set role = 'seller', phone = '+51 976 543 210', avatar_path = 'avatars/a0000000-0000-0000-0000-000000000005/avatar.jpg' where id = 'a0000000-0000-0000-0000-000000000005';
update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000006';
update public.profiles set phone = '+51 912 345 678' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set phone = '+51 923 456 789' where id = 'a0000000-0000-0000-0000-000000000002';
update public.profiles set phone = '+51 934 567 890' where id = 'a0000000-0000-0000-0000-000000000003';

-- ============================================================
-- CATEGORIES (8)
-- ============================================================
insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes');

-- ============================================================
-- PRODUCTS (16) — 9 de seller1 (TecnoStore Perú), 7 de seller2 (Gamer Zone
-- Perú). 2 inactivos (b...009 y b...016) y 1 con stock 0 (b...008), para
-- probar filtros de catálogo y la validación de stock en el checkout.
-- ============================================================
insert into public.products (id, seller_id, category_id, title, description, brand, condition, price, stock, is_active) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD', 'Ideal para estudios y teletrabajo. Procesador AMD Ryzen 5, pantalla Full HD antirreflejo y batería de larga duración. Incluye Windows 11 preinstalado.', 'Lenovo', 'nuevo', 2199.00, 8, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Laptop HP Pavilion 14" Intel i5 8GB 512GB SSD', 'Diseño compacto y liviano, perfecta para uso diario y oficina. Procesador Intel Core i5 de última generación con gráficos integrados Iris Xe.', 'HP', 'nuevo', 2499.00, 5, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Smartphone Samsung Galaxy A55 5G 128GB', 'Pantalla Super AMOLED de 6.6", cámara triple de 50MP y batería de 5000mAh. Compatible con redes 5G en Perú.', 'Samsung', 'nuevo', 1399.00, 12, true),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'Smartphone Xiaomi Redmi Note 13 Pro 256GB', 'Cámara principal de 108MP, carga rápida de 67W y pantalla AMOLED de 120Hz. Excelente relación precio-calidad.', 'Xiaomi', 'nuevo', 999.00, 15, true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'Procesador AMD Ryzen 5 5600X', '6 núcleos y 12 hilos, ideal para armar una PC de rendimiento gama media-alta para trabajo y juegos.', 'AMD', 'nuevo', 649.00, 10, true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'Memoria RAM Kingston Fury 16GB DDR4 3200MHz', 'Kit de memoria de alto rendimiento, compatible con la mayoría de placas madre AMD e Intel modernas.', 'Kingston', 'nuevo', 219.00, 20, true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006', 'Monitor LG 24" Full HD IPS', 'Panel IPS con colores precisos, ideal para diseño y oficina. Bordes delgados y soporte ajustable en altura.', 'LG', 'nuevo', 599.00, 7, true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000008', 'Router TP-Link Archer C6 AC1200', 'Router doble banda con 4 antenas externas, cobertura estable para hogares y oficinas pequeñas.', 'TP-Link', 'nuevo', 189.00, 0, true),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Laptop reacondicionada Dell Latitude 5490 i5 8GB 256GB', 'Equipo empresarial reacondicionado y probado, con garantía de 3 meses. Pausado temporalmente mientras se repone stock certificado.', 'Dell', 'reacondicionado', 1299.00, 4, false),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'Teclado mecánico Logitech G413', 'Switches táctiles resistentes, estructura de aluminio y retroiluminación blanca. Pensado para gaming y productividad.', 'Logitech', 'nuevo', 349.00, 14, true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'Mouse gamer Razer DeathAdder V3', 'Sensor óptico de alta precisión, forma ergonómica y switches ópticos de larga duración.', 'Razer', 'nuevo', 269.00, 18, true),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 'Audífonos HyperX Cloud Stinger 2', 'Sonido envolvente 7.1, diadema ajustable y micrófono con cancelación de ruido. Compatible con PC, PS5 y Switch.', 'HyperX', 'nuevo', 229.00, 25, true),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 'Parlante JBL Flip 6', 'Sonido potente y resistente al agua (IP67), hasta 12 horas de batería. Ideal para exteriores.', 'JBL', 'nuevo', 549.00, 9, true),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'Silla gamer Cougar Armor One', 'Reposabrazos 4D, reclinable hasta 180° y espuma de alta densidad. Soporta hasta 120kg.', 'Cougar', 'nuevo', 899.00, 6, true),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000007', 'Webcam Logitech C920 HD Pro', 'Video Full HD 1080p, enfoque automático y micrófono estéreo integrado. Ideal para streaming y videollamadas.', 'Logitech', 'nuevo', 379.00, 11, true),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005', 'Consola PlayStation 5 usada', 'Consola en buen estado, con un control original. Publicación pausada mientras el vendedor confirma disponibilidad.', 'Sony', 'usado', 2199.00, 3, false);

-- ============================================================
-- PRODUCT_IMAGES (2 por producto = 32 filas)
-- ============================================================
-- GAP CONOCIDO (documentado desde el día uno, lección de ReadHub): estos
-- paths siguen la convención del bucket product-images de la Fase 2.4
-- ({seller_id}/{product_id}/{n}.jpg), pero los ARCHIVOS no existen todavía
-- en Storage — nadie los subió por la UI. image_path guarda solo la ruta
-- DENTRO del bucket (sin el nombre del bucket), que es lo que compara la
-- política RLS storage.foldername(name).
insert into public.product_images (id, product_id, image_path, "position")
select
  ('e0000000-0000-0000-0000-' || lpad((2 * (n - 1) + img)::text, 12, '0'))::uuid,
  p.id,
  'product-images/' || p.seller_id || '/' || p.id || '/' || img || '.jpg',
  img - 1
from (
  select id, seller_id, row_number() over (order by id) as n
  from public.products
) p
cross join generate_series(1, 2) as img;

-- ============================================================
-- ORDERS + ORDER_ITEMS — al menos 1 por cada uno de los 5 estados.
-- ============================================================
insert into public.orders (id, buyer_id, status, total, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'entregado', 2428.00, now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'pendiente', 1399.00, now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'pagado', 618.00, now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'enviado', 599.00, now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'cancelado', 999.00, now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'entregado', 3048.00, now() - interval '15 days');

insert into public.order_items (id, order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD', 2199.00, 1),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'Audífonos HyperX Cloud Stinger 2', 229.00, 1),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'Smartphone Samsung Galaxy A55 5G 128GB', 1399.00, 1),
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'Teclado mecánico Logitech G413', 349.00, 1),
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'Mouse gamer Razer DeathAdder V3', 269.00, 1),
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'Monitor LG 24" Full HD IPS', 599.00, 1),
  ('f0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'Smartphone Xiaomi Redmi Note 13 Pro 256GB', 999.00, 1),
  ('f0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'Parlante JBL Flip 6', 549.00, 1),
  ('f0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'Laptop HP Pavilion 14" Intel i5 8GB 512GB SSD', 2499.00, 1);

-- ============================================================
-- QUESTIONS (8: 4 respondidas, 4 sin responder)
-- ============================================================
insert into public.questions (id, product_id, user_id, question, answer, answered_at, created_at) values
  ('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', '¿Viene con Windows instalado?', 'Sí, viene con Windows 11 Home preinstalado y activado de fábrica.', now() - interval '6 days', now() - interval '7 days'),
  ('10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '¿Es liberado para cualquier operador?', 'Sí, el equipo es liberado y funciona con cualquier operador en Perú.', now() - interval '4 days', now() - interval '5 days'),
  ('10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', '¿Tiene luces RGB?', 'No, este modelo usa retroiluminación blanca fija, sin efectos RGB.', now() - interval '2 days', now() - interval '3 days'),
  ('10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', '¿Es compatible con PS5?', 'Sí, funciona perfecto en PS5, PC y Nintendo Switch mediante el conector de 3.5mm.', now() - interval '1 day', now() - interval '2 days'),
  ('10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '¿Cuánto pesa la laptop?', null, null, now() - interval '1 day'),
  ('10000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '¿Trae cable HDMI incluido?', null, null, now() - interval '12 hours'),
  ('10000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', '¿Hasta qué peso soporta la silla?', null, null, now() - interval '8 hours'),
  ('10000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', '¿Cuántos meses de garantía tiene?', null, null, now() - interval '3 hours');

-- ============================================================
-- REVIEWS — solo sobre los pedidos 'entregado' (c...001 y c...006), y solo
-- de productos que esos pedidos realmente contienen (coherente con la
-- política reviews_insert_verified_purchase de la Fase 2.3).
-- ============================================================
insert into public.reviews (id, product_id, buyer_id, order_id, rating, comment, created_at) values
  ('20000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 5, 'Excelente laptop, rápida y silenciosa. Llegó bien empacada y en el tiempo indicado. Totalmente recomendada para trabajo y estudio.', now() - interval '15 days'),
  ('20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 4, 'Buen sonido y cómodos, aunque el micrófono podría ser un poco mejor. Por el precio, cumplen bien.', now() - interval '15 days'),
  ('20000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 5, 'El parlante suena increíble para su tamaño y la batería dura bastante más de lo esperado. Muy conforme con la compra.', now() - interval '10 days'),
  ('20000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006', 3, 'La laptop funciona bien pero la batería no dura lo que esperaba. El rendimiento para tareas básicas es correcto.', now() - interval '10 days');

-- ============================================================
-- FAVORITES (7 de muestra)
-- ============================================================
insert into public.favorites (id, user_id, product_id, created_at) values
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', now() - interval '4 days'),
  ('30000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010', now() - interval '2 days'),
  ('30000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('30000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000014', now() - interval '1 day'),
  ('30000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', now() - interval '3 days'),
  ('30000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007', now() - interval '5 days'),
  ('30000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000004', now() - interval '2 days');

-- ============================================================
-- PRODUCT_VIEWS (18 de muestra, incluye 2 anónimas con user_id null)
-- ============================================================
insert into public.product_views (id, product_id, user_id, viewed_at) values
  ('40000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now() - interval '20 days'),
  ('40000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', now() - interval '9 days'),
  ('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('40000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', now() - interval '10 days'),
  ('40000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', now() - interval '12 hours'),
  ('40000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('40000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('40000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', now() - interval '20 days'),
  ('40000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  ('40000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000002', now() - interval '1 day'),
  ('40000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  ('40000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000005', null, now() - interval '6 days'),
  ('40000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000015', null, now() - interval '7 days'),
  ('40000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', now() - interval '9 days');

-- ============================================================
-- SUPPORT_ARTICLES (10: 3 envíos, 3 pagos, 2 devoluciones, 2 cuenta) —
-- contenido real, base de conocimiento del RAG de la sesión 4.
-- ============================================================
insert into public.support_articles (id, title, content, category, is_published) values
  ('50000000-0000-0000-0000-000000000001', '¿Cuánto demora el envío de mi pedido?',
   'El tiempo de entrega depende de tu ubicación. Para Lima Metropolitana, los pedidos suelen llegar entre 2 y 4 días hábiles después de la confirmación del pago. Para provincias, el plazo estimado es de 4 a 8 días hábiles, dependiendo del operador logístico y la zona de destino.

En temporadas de alta demanda, como campañas o fechas festivas, estos plazos pueden extenderse hasta 2 días adicionales. Te recomendamos revisar el estado de tu pedido desde la sección "Mis pedidos", donde se actualiza el estado conforme avanza: pendiente, pagado, enviado y entregado.

Si tu pedido lleva más tiempo del estimado sin cambiar de estado, puedes abrir un ticket de soporte indicando el número de pedido para que lo revisemos.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000002', '¿Cuánto cuesta el envío?',
   'El costo de envío se calcula automáticamente al finalizar la compra, según tu distrito o ciudad de entrega y el peso/volumen de los productos comprados. En Lima Metropolitana, los envíos suelen costar entre $ 15.000 y $ 35.000 según la zona.

Para compras superiores a $ 300.000 en un mismo pedido, el envío es gratuito dentro de Lima Metropolitana. En provincias, el costo varía según el operador logístico disponible en tu zona y se muestra antes de confirmar la compra, nunca después.

Si compras productos de más de un vendedor en el mismo carrito, el sistema puede generar más de un pedido si los tiempos o costos de envío difieren entre vendedores.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000003', '¿Cómo hago seguimiento a mi pedido?',
   'Puedes seguir el estado de tu pedido en todo momento desde "Mis pedidos" en tu cuenta. Ahí verás el estado actual (pendiente, pagado, enviado, entregado o cancelado) y la fecha estimada de entrega.

Cuando el vendedor marca tu pedido como "enviado", en muchos casos se agrega un código de seguimiento del operador logístico, si el servicio contratado lo incluye. Este código te permite ver el recorrido del paquete directamente en la web del courier.

Si tienes dudas sobre el avance de tu pedido y no ves actualizaciones por varios días, comunícate con el vendedor a través de la sección de preguntas del producto o abre un ticket de soporte.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000004', '¿Qué métodos de pago aceptan?',
   'MercadoTech acepta tarjetas de crédito y débito (Visa, Mastercard) procesadas de forma segura, así como pago contra entrega en distritos seleccionados de Lima Metropolitana, sujeto a confirmación del vendedor.

También ofrecemos la opción de pago en cuotas con tarjetas de crédito participantes, mostrada directamente al finalizar la compra, cuando el banco emisor lo permite. El monto de las cuotas y los intereses aplicables los define tu entidad bancaria, no MercadoTech.

Todos los pagos con tarjeta se procesan mediante una pasarela cifrada; en ningún caso el número completo de tu tarjeta queda almacenado en nuestros servidores.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000005', '¿Es seguro pagar con tarjeta en MercadoTech?',
   'Sí. Todas las transacciones con tarjeta pasan por una pasarela de pago certificada que cifra tus datos de extremo a extremo. MercadoTech nunca almacena el número completo de tu tarjeta ni el código de seguridad (CVV).

Si notas un cargo que no reconoces, repórtalo de inmediato tanto a tu banco como a nuestro equipo de soporte mediante un ticket, indicando la fecha, el monto y el número de pedido si corresponde.

Como medida adicional, algunas compras de montos altos pueden requerir una verificación extra por parte de tu banco antes de confirmarse.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000006', '¿Puedo pagar contra entrega?',
   'El pago contra entrega está disponible solo para algunos distritos de Lima Metropolitana y depende de que el vendedor lo tenga habilitado para ese producto específico. Verás esta opción al finalizar la compra, únicamente si aplica a tu dirección y a los productos del carrito.

Al recibir el pedido, el repartidor cobra el monto exacto indicado en el pedido; te recomendamos tener el monto aproximado a la mano para agilizar la entrega.

Si el pedido incluye productos de distintos vendedores y no todos aceptan pago contra entrega, el sistema te pedirá elegir otro método de pago para completar la compra.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000007', '¿Cómo solicito la devolución de un producto?',
   'Tienes hasta 7 días calendario desde que el pedido se marca como "entregado" para solicitar una devolución, siempre que el producto esté en las mismas condiciones en que lo recibiste, con su empaque original y accesorios completos.

Para iniciar el proceso, abre un ticket de soporte indicando el número de pedido, el producto y el motivo de la devolución. Nuestro equipo coordina la recolección con el vendedor y te confirma los siguientes pasos por el mismo canal.

Una vez que el vendedor confirma la recepción y verifica el estado del producto, el reembolso se procesa al mismo método de pago original en un plazo de 5 a 10 días hábiles.',
   'devoluciones', true),
  ('50000000-0000-0000-0000-000000000008', '¿Qué productos no admiten devolución?',
   'Por motivos de higiene y seguridad, algunos productos no admiten devolución una vez abiertos, como audífonos in-ear y ciertos accesorios personales, salvo que presenten una falla de fábrica comprobable.

Los productos reacondicionados y de segunda mano (marcados como "usado" o "reacondicionado") tienen una política de devolución más corta, de 3 días calendario, y solo proceden por fallas técnicas no informadas en la publicación original.

En todos los casos de falla de fábrica, el vendedor es responsable de la reparación, reemplazo o reembolso, según corresponda, sin costo adicional para el comprador.',
   'devoluciones', true),
  ('50000000-0000-0000-0000-000000000009', '¿Cómo creo o verifico mi cuenta?',
   'Para crear una cuenta necesitas un correo electrónico válido y una contraseña. Después del registro, te enviamos un correo de verificación; algunas funciones, como publicar productos si eres vendedor, requieren que confirmes tu correo antes de habilitarse.

Puedes completar tu perfil agregando tu nombre visible, número de teléfono y foto de perfil desde la sección "Mi cuenta". Esta información ayuda a que compradores y vendedores generen más confianza entre sí durante una compraventa.

Si te registraste con un correo incorrecto, contáctanos por un ticket de soporte para actualizarlo; por seguridad, este cambio no se puede hacer directamente desde el perfil.',
   'cuenta', true),
  ('50000000-0000-0000-0000-000000000010', 'Olvidé mi contraseña, ¿cómo la recupero?',
   'En la pantalla de inicio de sesión, selecciona la opción "¿Olvidaste tu contraseña?" e ingresa el correo con el que te registraste. Te enviaremos un enlace para crear una nueva contraseña, válido por un tiempo limitado.

Si no recibes el correo en unos minutos, revisa tu carpeta de spam o promociones. Si el problema persiste, verifica que estés usando el mismo correo con el que creaste la cuenta.

Por seguridad, evita reutilizar contraseñas de otros servicios y usa una combinación de letras, números y símbolos. Si sospechas que alguien más accedió a tu cuenta, cambia tu contraseña de inmediato y contáctanos por un ticket de soporte.',
   'cuenta', true);

-- ============================================================
-- SUPPORT_TICKETS + TICKET_MESSAGES (2 tickets)
-- ============================================================
insert into public.support_tickets (id, user_id, subject, status, channel, created_at) values
  ('60000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'No he recibido mi pedido enviado hace una semana', 'en_proceso', 'chat', now() - interval '2 days'),
  ('60000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '¿Cómo cambio mi contraseña?', 'resuelto', 'chat', now() - interval '6 days');

insert into public.ticket_messages (id, ticket_id, sender_role, content, created_at) values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'usuario', 'Hola, mi pedido figura como "enviado" desde hace una semana y todavía no me llega. ¿Pueden revisar qué pasó?', now() - interval '2 days'),
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'agente', 'Hola Jorge, con gusto te ayudo. ¿Me puedes confirmar el número de pedido para revisar el estado con el vendedor?', now() - interval '2 days' + interval '10 minutes'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'usuario', 'Sí, es el pedido c0000000-0000-0000-0000-000000000004, el del monitor LG.', now() - interval '2 days' + interval '25 minutes'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', 'agente', 'Gracias. Ya contacté al vendedor para que confirme el código de seguimiento; en cuanto lo tengamos te lo compartimos por este mismo chat.', now() - interval '2 days' + interval '40 minutes'),
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000002', 'usuario', 'Hola, olvidé mi contraseña y no sé cómo recuperarla.', now() - interval '6 days'),
  ('70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000002', 'agente', 'Hola Ana, ve a la pantalla de inicio de sesión y selecciona "¿Olvidaste tu contraseña?". Te llegará un enlace a tu correo para crear una nueva.', now() - interval '6 days' + interval '5 minutes'),
  ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000002', 'usuario', 'Perfecto, ya pude entrar de nuevo. ¡Gracias!', now() - interval '6 days' + interval '20 minutes');

-- ============================================================================
-- RESUMEN
-- ============================================================================
-- auth.users / profiles ......... 6  (3 buyers, 2 sellers, 1 admin)
-- categories ..................... 8
-- products ....................... 16 (2 inactivos, 1 con stock 0)
-- product_images .................. 32 (2 por producto — sin archivo real en Storage)
-- orders ........................... 6 (1 pendiente, 1 pagado, 1 enviado, 2 entregado, 1 cancelado)
-- order_items ....................... 9
-- questions ........................... 8 (4 respondidas, 4 sin responder)
-- reviews ................................ 4 (solo sobre pedidos entregados)
-- favorites ................................. 7
-- product_views ................................ 18 (2 anónimas, user_id null)
-- support_articles ................................. 10 (3 envíos, 3 pagos, 2 devoluciones, 2 cuenta)
-- support_tickets .................................... 2
-- ticket_messages ....................................... 7
--
-- Credenciales (contraseña común: MercadoTech123!):
--   buyer1@mercadotech.test   — María Fernanda Quispe (buyer)
--   buyer2@mercadotech.test   — Jorge Luis Ramírez    (buyer)
--   buyer3@mercadotech.test   — Ana Lucía Torres      (buyer)
--   seller1@mercadotech.test  — TecnoStore Perú       (seller)
--   seller2@mercadotech.test  — Gamer Zone Perú       (seller)
--   admin1@mercadotech.test   — Admin MercadoTech     (admin)
-- ============================================================================
