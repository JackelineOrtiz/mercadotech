-- Supabase ya trae pgcrypto habilitado por defecto en el proyecto, pero se
-- declara explícito e idempotente aquí para que `supabase db reset` no
-- dependa de configuración implícita del proyecto remoto.
-- Nota: gen_random_uuid() es nativo de PostgreSQL 13+ (no requiere pgcrypto),
-- pero se deja pgcrypto disponible por si alguna fase futura la necesita
-- (ej. hashing) sin otra migración de setup.
create extension if not exists "pgcrypto" with schema extensions;
