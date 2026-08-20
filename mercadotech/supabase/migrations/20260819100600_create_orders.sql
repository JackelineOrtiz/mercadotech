-- ORDERS
-- SUPUESTO (spec no lo marca explícito para "total", solo dice "Precios > 0"
-- en las restricciones globales): se aplica el mismo criterio a total, ya
-- que create_order_from_cart siempre lo calcula como suma de price*quantity
-- de al menos un ítem, así que nunca debería ser <= 0.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  total numeric(12, 2) not null check (total > 0),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_buyer_id_idx on public.orders (buyer_id);
