-- REVIEWS: reseñas verificadas — order_id ancla la reseña a la compra que la
-- habilita (la Fase 2.3 exige, vía RLS, que ese pedido esté 'entregado' y
-- contenga el producto).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  order_id uuid not null references public.orders (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- Una reseña por comprador y producto (independiente de cuántas veces lo
  -- haya comprado).
  unique (product_id, buyer_id)
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews (product_id);
