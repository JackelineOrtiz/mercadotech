-- CATEGORIES: árbol simple (parent_id nullable = raíz del árbol).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories (id),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
