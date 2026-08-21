-- Storage: buckets product-images y avatars, ambos de lectura pública.
-- storage.objects ya trae RLS habilitado y GRANTs base a anon/authenticated
-- desde la instalación de la extensión Storage — a diferencia del esquema
-- public que armamos nosotros, aquí NO hace falta otorgar GRANTs de tabla:
-- el control de acceso vive enteramente en las políticas de abajo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- ============================================================
-- PRODUCT-IMAGES — path: {seller_id}/{product_id}/{n}.{ext}
-- ============================================================
-- SELECT: además de servir por la URL pública (bucket public=true, que no
-- pasa por RLS), se deja una política explícita para que .list()/.download()
-- por la API autenticada también funcionen — el flag "public" del bucket
-- solo cubre el endpoint /object/public/..., no las demás rutas de la API.
create policy "product_images_objects_select_public" on storage.objects
  for select
  using (bucket_id = 'product-images');

-- INSERT: carpeta propia (primer segmento del path = auth.uid()) Y rol
-- 'seller' — refuerza a nivel Storage la misma regla que products_insert
-- (Fase 2.3): un buyer no debería poder acumular archivos en un bucket que
-- es, por diseño, solo para vendedores.
create policy "product_images_objects_insert_own_seller_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'seller'
    )
  );

-- DELETE: solo carpeta propia. Sin el check de rol — si alguien deja de ser
-- vendedor, debe poder seguir borrando lo que ya subió.
create policy "product_images_objects_delete_own_folder" on storage.objects
  for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

-- Sin política de UPDATE: el flujo del vendedor es subir y borrar: para
-- "reemplazar" una imagen se sube una nueva y se borra la vieja (o se hace
-- upsert sobre el mismo path, que Storage resuelve como create+overwrite,
-- no como un UPDATE de fila vía SQL).

-- ============================================================
-- AVATARS — path: {user_id}/...
-- ============================================================
create policy "avatars_objects_select_public" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- INSERT/DELETE: cualquier usuario autenticado (buyer/seller/admin, todos
-- tienen avatar) dentro de su propia carpeta. DELETE no lo pedía la spec
-- explícita, pero sin él un usuario no podría quitar su avatar actual antes
-- de subir uno nuevo con otro nombre de archivo — se agrega por consistencia
-- con product-images.
create policy "avatars_objects_insert_own_folder" on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

create policy "avatars_objects_delete_own_folder" on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name)) [1] = (select auth.uid())::text
  );

-- Sin política de UPDATE, misma razón que product-images.
