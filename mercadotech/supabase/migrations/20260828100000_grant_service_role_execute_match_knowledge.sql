-- Fase 5.3 (Sesión 5) — hallazgo real al probar semantic_search_products,
-- ask_assistant y find_related_products contra el Inspector: las tres
-- llaman a match_knowledge() con el cliente ADMIN (decisión 3 de la spec
-- de la Sesión 5 — knowledge_embeddings solo permite SELECT a
-- `authenticated`, y el servidor MCP no tiene una sesión de usuario que
-- ofrecer). match_knowledge es `security invoker` (Fase 4.1): el rol que
-- la EJECUTA necesita su propio GRANT EXECUTE, además de poder leer
-- knowledge_embeddings — ese SELECT ya lo tiene service_role desde la
-- Fase 4.1/4.3, pero el EXECUTE de la función nunca se le otorgó, porque
-- hasta ahora match_knowledge SIEMPRE se había llamado con el cliente de
-- SESIÓN (chat.service.ts/vector-search.service.ts, Sesión 4), nunca con
-- el admin. Mismo patrón exacto que el hallazgo de la Fase 4.3
-- (BYPASSRLS de service_role no sustituye los GRANT normales de
-- Postgres), aplicado a una función en vez de a una tabla.
--
-- Tipo calificado como `extensions.vector` (no `vector` a secas): esta
-- migración corrió sin problema en local/CI porque `extra_search_path` de
-- config.toml agrega "extensions" al search_path del stack de `supabase
-- start` — pero `supabase db push` contra un proyecto remoto (Fase 7.4)
-- NO aplica ese ajuste, y el statement fallaba con "type vector does not
-- exist (SQLSTATE 42704)". Mismo tipo que ya usa create_match_knowledge.sql
-- (Fase 4.1) al declarar el parámetro `query_embedding extensions.vector(384)`.
-- Reproducido y confirmado el fix corriendo ambas variantes directo contra
-- Postgres local con `search_path` restringido a `public` (2026-09-01).
grant execute on function public.match_knowledge(extensions.vector, text, integer, double precision)
  to service_role;

-- Mismo hallazgo, mismo origen (probado en el Inspector al ejercitar
-- get_order_status y get_store_stats): orders/order_items nunca tuvieron
-- GRANT SELECT para service_role — solo tenían los grants reflejos que
-- Postgres da por default (TRIGGER/REFERENCES/TRUNCATE), no acceso a
-- datos. get_order_status (tool #10) necesita leer un pedido con
-- CUALQUIER comprador, no solo el propio — no hay política de orders que
-- lo permita sin admin. get_store_stats (tool #9, "top vendidos") agrega
-- order_items de TODOS los vendedores, no solo uno — mismo motivo.
grant select on public.orders to service_role;
grant select on public.order_items to service_role;

-- AMPLIADO en la Fase 5.4: mismo hallazgo, mismo origen. El resource
-- mercadotech://sellers/{sellerId} (decisión 5 — profiles sin SELECT
-- público, RLS de la Fase 2.3) necesita leer profiles.display_name de
-- CUALQUIER vendedor con el cliente admin; nunca se le había dado GRANT.
-- shared/sellers.ts hace un select() plano de una sola columna a
-- propósito (nunca "*"), pero igual necesita el GRANT de tabla para poder
-- correr esa columna siquiera.
grant select on public.profiles to service_role;
