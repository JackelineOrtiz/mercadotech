-- Políticas y GRANTs de knowledge_embeddings (decisión 1 de la Sesión 4: la
-- IA exige sesión — ni anon ni la cuota gratuita de Hugging Face quedan
-- expuestas a un visitante sin cuenta).
--
-- SELECT: solo authenticated. Los productos INACTIVOS igual tienen ficha
-- aquí (nada la borra al desactivar, solo al eliminar) — no se filtra en
-- esta política porque esta tabla no sabe de products.is_active; el
-- descarte pasa en el service (vector-search.service, Fase 4.4), que
-- hidrata contra products y descarta lo que ya no es visible.
create policy "knowledge_embeddings_select_authenticated" on public.knowledge_embeddings
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: sin política — service_role tiene BYPASSRLS, así
-- que ninguna política de esta tabla lo restringe de todos modos (RLS no
-- aplica a un rol con ese atributo). Solo el cliente admin escribe aquí,
-- desde embedding.service.ts inyectado en un Route Handler o en scripts/
-- (Fase 4.2/4.3), nunca desde el navegador.
--
-- CORRECCIÓN (verificado al construir la Fase 4.3, no al escribir esto):
-- BYPASSRLS es un mecanismo DISTINTO de los GRANT normales de Postgres —
-- salta la evaluación de políticas, pero un rol sigue necesitando el
-- privilegio de tabla (SELECT/INSERT/...) para poder tocarla. service_role
-- NO lo tiene por defecto en este stack local (confirmado contra
-- information_schema.role_table_grants: solo REFERENCES/TRIGGER/TRUNCATE,
-- heredados de un default distinto a los de datos). El comentario anterior
-- de este archivo asumía lo contrario sin haberlo probado — el primer
-- intento real de embedding.service.ts contra el endpoint de reindexado
-- (Fase 4.3) falló con "permission denied for table products" cuando el
-- código en sí era correcto. Se corrige aquí en vez de con una migración
-- aparte porque este archivo es de esta misma sesión y no se desplegó a
-- ningún entorno real (mismo criterio que la Fase 2.5 al corregir RLS de
-- la Fase 2.3).
grant select, insert, update, delete on public.knowledge_embeddings to service_role;

grant select on public.knowledge_embeddings to authenticated;
