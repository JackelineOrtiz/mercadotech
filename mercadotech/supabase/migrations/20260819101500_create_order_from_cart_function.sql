-- create_order_from_cart: única vía para crear un pedido. orders/order_items
-- no aceptan insert directo del cliente (política de la Fase 2.3) — todo
-- pasa por aquí para garantizar que stock, snapshot y vaciado de carrito
-- ocurran de forma atómica.
--
-- SECURITY DEFINER porque valida y descuenta stock de productos de
-- CUALQUIER vendedor, algo que el comprador no tiene permiso de hacer
-- directamente vía RLS. La validación p_buyer_id = auth.uid() de abajo es
-- lo que evita que se abuse del privilegio elevado para vaciar el carrito
-- o generar pedidos de otro usuario.
create function public.create_order_from_cart(p_buyer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_item record;
begin
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'p_buyer_id no coincide con el usuario autenticado';
  end if;

  if not exists (select 1 from public.cart_items where user_id = p_buyer_id) then
    raise exception 'El carrito está vacío';
  end if;

  -- Paso 1: bloquear (for update) las filas de producto involucradas y
  -- validar disponibilidad + acumular el total, antes de escribir nada.
  -- El bloqueo se mantiene hasta el final de la transacción (el commit
  -- implícito al retornar), así que sigue vigente en el paso 3.
  for v_item in
    select
      ci.product_id,
      ci.quantity,
      p.title,
      p.price,
      p.stock,
      p.is_active
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    order by ci.product_id
    for update of p
  loop
    if not v_item.is_active then
      raise exception 'El producto "%" ya no está disponible', v_item.title;
    end if;

    if v_item.stock < v_item.quantity then
      raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
        v_item.title, v_item.stock, v_item.quantity;
    end if;

    v_total := v_total + (v_item.price * v_item.quantity);
  end loop;

  -- Paso 2: crear el pedido con el total ya validado.
  insert into public.orders (buyer_id, status, total)
  values (p_buyer_id, 'pendiente', v_total)
  returning id into v_order_id;

  -- Paso 3: crear los order_items con snapshot, descontar stock y vaciar
  -- el carrito. Los productos siguen bloqueados desde el paso 1, así que el
  -- descuento de stock es seguro frente a otro checkout concurrente.
  for v_item in
    select
      ci.product_id,
      ci.quantity,
      p.title,
      p.price,
      p.seller_id
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    order by ci.product_id
  loop
    insert into public.order_items
      (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
    values
      (v_order_id, v_item.product_id, v_item.seller_id, v_item.title, v_item.price, v_item.quantity);

    update public.products
    set stock = stock - v_item.quantity
    where id = v_item.product_id;
  end loop;

  delete from public.cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_cart (uuid) from public;
revoke execute on function public.create_order_from_cart (uuid) from anon;
grant execute on function public.create_order_from_cart (uuid) to authenticated;
