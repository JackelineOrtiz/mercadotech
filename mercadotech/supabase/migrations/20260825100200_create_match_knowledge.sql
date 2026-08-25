-- match_knowledge: dado el embedding de una pregunta, devuelve las fichas
-- más parecidas de knowledge_embeddings. SECURITY INVOKER (no DEFINER,
-- a diferencia de is_admin()/is_order_buyer() de la Fase 2.3): esta función
-- no necesita saltarse RLS, así que corre con los privilegios del que la
-- llama y respeta la política SELECT de knowledge_embeddings (solo
-- authenticated) sin necesitar lógica propia de autorización.
--
-- similarity = 1 - distancia_coseno: el operador `<=>` de pgvector devuelve
-- distancia de coseno (0 = idéntico, 2 = opuesto), no similitud; se invierte
-- aquí para que el resto del código (threshold, orden) trabaje con
-- "más alto = más parecido", más intuitivo que una distancia.
create function public.match_knowledge(
  query_embedding extensions.vector(384),
  p_source_type text default null,
  match_count int default 5,
  similarity_threshold float default 0.3
)
returns table (
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
security invoker
set search_path = public, extensions
stable
as $$
  select
    ke.source_type,
    ke.source_id,
    ke.content,
    ke.metadata,
    1 - (ke.embedding <=> query_embedding) as similarity
  from public.knowledge_embeddings ke
  where (p_source_type is null or ke.source_type = p_source_type)
    and 1 - (ke.embedding <=> query_embedding) >= similarity_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_knowledge(extensions.vector(384), text, int, float)
  from public, anon;
grant execute on function public.match_knowledge(extensions.vector(384), text, int, float)
  to authenticated;
