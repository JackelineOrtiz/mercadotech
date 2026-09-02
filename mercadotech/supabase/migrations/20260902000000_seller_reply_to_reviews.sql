-- Respuesta del vendedor a una reseña (Fase 7.5, hallazgo real: no existía
-- ninguna columna ni política para esto — el vendedor no tenía forma de
-- responder una reseña de su producto).
alter table public.reviews
  add column seller_reply text,
  add column seller_reply_at timestamptz;

-- RLS ya tenía reviews_update_own (el COMPRADOR edita su propia reseña,
-- sin restricción de columna — deuda preexistente, fuera de alcance acá)
-- más un GRANT amplio `update` a `authenticated` sin restricción de
-- columna. Ninguno de los dos alcanza para "el vendedor solo puede tocar
-- seller_reply/seller_reply_at, nunca rating/comment/buyer_id" — mismo
-- problema que ya resolvió protect_profiles_role (Fase 2.3) para
-- profiles.role, así que se aplica el mismo patrón: un trigger es la
-- única forma real de restringir POR COLUMNA según quién hace el UPDATE,
-- porque RLS opera sobre filas, no columnas.
create function public.protect_review_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if (select auth.uid()) = old.buyer_id then
    if new.seller_reply is distinct from old.seller_reply
      or new.seller_reply_at is distinct from old.seller_reply_at then
      raise exception 'Solo el vendedor puede responder esta reseña';
    end if;
    return new;
  end if;

  if exists (
    select 1 from public.products p
    where p.id = old.product_id and p.seller_id = (select auth.uid())
  ) then
    if new.rating is distinct from old.rating
      or new.comment is distinct from old.comment
      or new.buyer_id is distinct from old.buyer_id
      or new.product_id is distinct from old.product_id
      or new.order_id is distinct from old.order_id then
      raise exception 'El vendedor solo puede editar su respuesta a la reseña';
    end if;
    return new;
  end if;

  raise exception 'No tenés permiso para editar esta reseña';
end;
$$;

create trigger protect_review_columns_trigger
  before update on public.reviews
  for each row
  execute function public.protect_review_columns();

-- Nueva política: sin esto, RLS bloquea al vendedor ANTES de que el
-- trigger de arriba llegue a evaluarse (reviews_update_own solo deja
-- pasar filas donde buyer_id = auth.uid()). El trigger es quien restringe
-- QUÉ columnas puede tocar; esta política solo habilita que la fila sea
-- alcanzable para el vendedor dueño del producto.
create policy "reviews_update_seller_reply" on public.reviews
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = reviews.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = reviews.product_id and p.seller_id = (select auth.uid())
    )
  );
