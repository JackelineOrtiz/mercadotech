-- ORDER_ITEMS: snapshot de título y precio (histórico inmutable — si el
-- vendedor edita el producto después, el pedido ya facturado no cambia) y
-- seller_id denormalizado (permite que la política RLS del vendedor filtre
-- "sus" order_items sin tener que hacer join contra products en cada fila).
--
-- SUPUESTO (spec no especifica on delete para product_id): se deja sin
-- acción explícita (RESTRICT por defecto), a diferencia de order_id que sí
-- es cascade. Un producto con historial de pedidos no debe poder borrarse
-- físicamente — el soft-delete es is_active en products.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  seller_id uuid not null references public.profiles (id),
  title_snapshot text not null,
  price_snapshot numeric(12, 2) not null check (price_snapshot > 0),
  quantity integer not null check (quantity > 0)
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_id_idx on public.order_items (seller_id);
