-- embedding.service.ts (Fase 4.2) lee products/categories/support_articles
-- con el cliente admin (service_role) para armar el texto de cada ficha —
-- descubierto al construir el endpoint de reindexado (Fase 4.3):
-- service_role tiene BYPASSRLS (salta las políticas), pero NO tiene los
-- GRANT de tabla normales de Postgres, que son un mecanismo aparte y
-- siguen exigiéndose incluso con BYPASSRLS. Sin este GRANT, cualquier
-- SELECT del cliente admin sobre estas tablas falla con
-- "permission denied for table products", no con un resultado vacío (RLS
-- vacío se ve distinto de un permiso de tabla faltante).
--
-- Migración NUEVA, no se toca la migración original de products/categories/
-- support_articles (Fase 2.2) ni sus políticas (Fase 2.3) — solo se agrega
-- el GRANT que faltaba para el rol nuevo que las empezó a leer esta sesión.
grant select on public.products to service_role;
grant select on public.categories to service_role;
grant select on public.support_articles to service_role;
