-- Fase 7.5 (fuera del PDF de la spec, pedido explícito del usuario): el panel
-- de admin (/admin/usuarios) era de solo lectura — la ÚNICA forma de volver
-- "seller" a un usuario nuevo era tocar la tabla directo por SQL, ni
-- siquiera un admin real podía hacerlo por la interfaz. El trigger
-- protect_profiles_role (Fase 2.3) YA contemplaba este caso
-- ("...salvo que sea un admin...", is_admin()) pero faltaban las dos piezas
-- que lo dejaban sin efecto:
--   1. profiles_update_own (Fase 2.3) es SOLO "mi propia fila" — sin bypass
--      de admin, a diferencia de profiles_select_own_or_admin.
--   2. El GRANT de columnas de profiles (Fase 2.3) nunca incluyó "role" —
--      ni siquiera pasando la policy, el UPDATE fallaría por falta de
--      permiso a nivel de columna.
--
-- Este archivo agrega exactamente esas dos piezas, sin tocar nada más:
-- un admin puede actualizar CUALQUIER perfil (mismo alcance que ya tiene
-- para SELECT), y la columna "role" queda otorgada. protect_profiles_role
-- sigue siendo la defensa en profundidad real: si is_admin() da false,
-- bloquea el cambio de rol igual, sin importar qué diga esta policy.

create policy "profiles_update_admin" on public.profiles
  for update
  using (public.is_admin())
  with check (public.is_admin());

grant update (role) on public.profiles to authenticated;
