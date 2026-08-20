-- PROFILES: 1:1 con auth.users. El id NO se genera aquí: es el mismo uuid
-- que auth.users.id (lo asigna el trigger handle_new_user de abajo).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SUPUESTO (spec no lo detalla): display_name inicial se toma de
-- raw_user_meta_data->>'display_name' si el signup lo mandó (ej. formulario
-- de registro de la sesión 3); si no vino, queda null y el usuario lo
-- completa después desde su perfil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Función utilitaria reusada por cualquier tabla con updated_at (products,
-- support_articles). Vive aquí, junto a la primera migración que la necesita,
-- para no crear un archivo de "utilidades" separado sin más contenido.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
