-- cancel_order_and_restock: única vía para cancelar un pedido pendiente.
-- Antes (decisión 11 de la spec, ya no vigente): cancelar solo cambiaba
-- orders.status, sin reponer stock — deuda aceptada y documentada desde la
-- Sesión 2/3. Hallazgo real de un usuario probando la app (Fase 7.5):
-- canceló un pedido y el producto siguió mostrando 0 disponibles. Mismo
-- patrón que create_order_from_cart: SECURITY DEFINER porque reponer stock
-- de productos de OTRO vendedor no es algo que el comprador pueda hacer
-- directo vía RLS — la función valida buyer_id = auth.uid() y
-- status = 'pendiente' antes de tocar nada (misma restricción que ya
-- imponía orders_update_seller_advance_or_buyer_cancel + el filtro
-- .eq("status", "pendiente") de cancelIfPending, ahora reforzada dentro de
-- la función en vez de en dos lugares distintos).
create function public.cancel_order_and_restock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid;
  v_status text;
  v_item record;
begin
  -- Bloquea la fila del pedido hasta el commit implícito — evita una
  -- cancelación doble concurrente reponiendo stock dos veces.
  select buyer_id, status into v_buyer_id, v_status
  from public.orders
  where id = p_order_id
  for update;

  if v_buyer_id is null then
    raise exception 'Pedido no encontrado';
  end if;

  if v_buyer_id is distinct from auth.uid() then
    raise exception 'Solo el comprador puede cancelar este pedido';
  end if;

  if v_status is distinct from 'pendiente' then
    raise exception 'Solo se puede cancelar un pedido pendiente';
  end if;

  -- order_items.product_id es "on delete restrict" (Fase 2.2): un producto
  -- con historial de ventas nunca se borra físicamente, así que el UPDATE
  -- de abajo siempre encuentra la fila.
  for v_item in
    select product_id, quantity from public.order_items where order_id = p_order_id
  loop
    update public.products
    set stock = stock + v_item.quantity
    where id = v_item.product_id;
  end loop;

  update public.orders set status = 'cancelado' where id = p_order_id;
end;
$$;

revoke execute on function public.cancel_order_and_restock (uuid) from public;
revoke execute on function public.cancel_order_and_restock (uuid) from anon;
grant execute on function public.cancel_order_and_restock (uuid) to authenticated;
