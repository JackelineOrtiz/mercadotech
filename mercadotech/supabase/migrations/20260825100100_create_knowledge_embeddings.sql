-- KNOWLEDGE_EMBEDDINGS: el "fichero" del bibliotecario (Sesión 4). Una sola
-- tabla para las dos fuentes que esta sesión indexa (products y
-- support_articles), discriminada por source_type — más simple que dos
-- tablas gemelas y permite buscar en ambas fuentes con una sola consulta.
--
-- source_id SIN foreign key: apunta a dos tablas origen distintas
-- (products.id o support_articles.id según source_type), y Postgres no
-- soporta una FK condicional a "una de dos tablas". Consecuencia aceptada:
-- si se borra un producto o un artículo, su ficha queda huérfana aquí hasta
-- que algo la limpie explícitamente — el service de indexación (Fase 4.3)
-- borra la ficha al borrar el producto, y vector-search.service (Fase 4.4)
-- descarta huérfanos al hidratar resultados contra la fuente real, así que
-- un huérfano nunca llega a mostrarse, aunque exista la fila.
--
-- SUPUESTO (spec no lo detalla): chunk_index default 0 dejado tal cual —
-- esta sesión indexa cada fuente como un solo chunk; la columna existe para
-- no tener que migrar de nuevo si un futuro chunking parte un texto largo
-- en varias fichas.
create table public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('producto', 'articulo_soporte')),
  source_id uuid not null,
  chunk_index integer not null default 0,
  content text not null,
  -- vector(384): dimensión de sentence-transformers/all-MiniLM-L6-v2
  -- (Guía HF, lección 6, y lib/constants/ai.ts en la Fase 4.2). Cambiar de
  -- modelo de embeddings a uno con otra dimensión exige una migración
  -- nueva: `alter table ... alter column embedding type vector(N)`, borrar
  -- y recrear el índice HNSW de abajo (queda atado a la dimensión con la
  -- que se crea) y recrear match_knowledge (su firma fija vector(384)) —
  -- no alcanza con cambiar HUGGINGFACE_EMBEDDING_MODEL.
  embedding extensions.vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

alter table public.knowledge_embeddings enable row level security;

-- HNSW + vector_cosine_ops: la similitud de coseno es la que usa
-- match_knowledge (operador `<=>`) — el índice debe crearse con los mismos
-- ops que la consulta o Postgres no lo usa y cae a escaneo secuencial.
create index knowledge_embeddings_embedding_idx
  on public.knowledge_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create index knowledge_embeddings_source_idx
  on public.knowledge_embeddings (source_type, source_id);
