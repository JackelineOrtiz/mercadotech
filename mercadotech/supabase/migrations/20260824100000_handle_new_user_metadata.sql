-- Sesión 3, Fase 3.3: registrarse como vendedor era imposible. La función
-- handle_new_user original (Fase 2.2, 20260819100100_create_profiles.sql)
-- inserta el profile sin leer "role" de ningún lado, así que la fila
-- siempre nace con el default de la columna ('buyer'). Y como el trigger
-- protect_profiles_role (Fase 2.3, 20260819110000_create_rls_policies.sql)
-- bloquea que un usuario cambie su propio role después de creado, el INSERT
-- de este trigger es el ÚNICO momento en TODO el sistema donde el role de
-- un signup normal puede fijarse a algo distinto de 'buyer' — de ahí que
-- esta migración reemplace la función en vez de tocarla desde afuera.
--
-- No se edita la migración original de la Fase 2.2 (regla de la sesión):
-- se reemplaza la función completa con CREATE OR REPLACE en un archivo
-- nuevo. El trigger on_auth_user_created (Fase 2.2) sigue apuntando a
-- public.handle_new_user() por nombre, así que no hace falta tocarlo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    -- Blindaje contra manipulación del cliente: cualquier valor que no sea
    -- exactamente 'buyer' o 'seller' (incluido 'admin', vacío, o ausente)
    -- cae a 'buyer'. No hay forma de registrarse como admin.
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;
