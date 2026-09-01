-- Trabajo ad-hoc (fuera del temario de las sesiones, ver docs/BITACORA.md):
-- storefront público del vendedor. profiles_select_own_or_admin (Fase 2.3)
-- solo deja leer la propia fila o, si sos admin, cualquiera — ni QuestionsSection
-- ni ReviewsSection pueden mostrar el nombre real de nadie hoy, y no existe
-- forma de que un comprador vea "quién vende esto" (deuda ya documentada en
-- docs/BITACORA.md de sesiones anteriores: "sin public_profiles").
--
-- No se toca la política de profiles (agregar un SELECT público ahí
-- expondría TODAS las columnas, incluido phone, a cualquiera con sesión —
-- el GRANT de la Fase 2.3 es "grant select on public.profiles to
-- authenticated" SIN restricción de columnas, a diferencia del UPDATE que sí
-- la tiene). Una vista es la herramienta correcta: solo expone las columnas
-- que se listan acá, nunca las demás, sin importar qué agregue profiles en
-- el futuro.
--
-- Por qué esto SÍ bypassea RLS de profiles sin querer decir "cualquiera lee
-- profiles completo": esta vista la crea (y por lo tanto es dueña) el rol
-- que corre las migraciones (postgres), y Postgres NO aplica RLS al dueño
-- de la tabla subyacente salvo que la tabla tenga FORCE ROW LEVEL SECURITY
-- (profiles no la tiene) — así que la vista ve TODAS las filas de profiles
-- al evaluarse, y filtra ella misma a solo `role = 'seller'`, exponiendo
-- únicamente id/display_name/avatar_path. Verificado en vivo: una consulta
-- anon a esta vista devuelve las filas de vendedores aunque la misma
-- consulta directa a profiles (con el mismo anon key) devuelva vacío.
create view public.public_profiles as
select id, display_name, avatar_path
from public.profiles
where role = 'seller';

grant select on public.public_profiles to anon, authenticated;
