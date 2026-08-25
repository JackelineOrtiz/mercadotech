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

-- INSERT/UPDATE/DELETE: sin política ni GRANT — deliberado, no un olvido.
-- Solo el cliente admin (service_role) escribe aquí, desde
-- embedding.service.ts inyectado en un Route Handler o en scripts/ (Fase
-- 4.2/4.3), nunca desde el navegador. service_role ya tiene BYPASSRLS y
-- privilegios de tabla desde el bootstrap del proyecto (mismo patrón que
-- create_order_from_cart, Fase 2.2: ningún GRANT explícito a service_role
-- en ninguna migración de este repo).

grant select on public.knowledge_embeddings to authenticated;
