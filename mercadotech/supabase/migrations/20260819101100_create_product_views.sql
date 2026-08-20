-- PRODUCT_VIEWS: cada apertura de un producto es un evento (sin contador
-- agregado — se cuenta con COUNT() cuando haga falta, ej. analítica del
-- vendedor).
--
-- SUPUESTO (spec no marca user_id como not null): se deja nullable para
-- permitir registrar vistas de visitantes no autenticados; el frontend
-- decide si las manda o no.
create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid references public.profiles (id),
  viewed_at timestamptz not null default now()
);

alter table public.product_views enable row level security;

create index product_views_product_id_idx on public.product_views (product_id);
