import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { UserRole, OrderStatus } from "@/lib/constants/roles";
import type { Profile } from "@/types/user";

type Client = SupabaseClient<Database>;

// Fuera del PDF de la spec: panel de admin (ver docs/BITACORA.md). A
// diferencia de mcp/src/shared/stats.ts (Fase 5, get_store_stats), este
// archivo NUNCA usa el cliente admin — corre con la sesión normal del
// admin logueado, apoyándose en el bypass "or public.is_admin()" que ya
// tienen profiles_select_own_or_admin, orders_select_buyer_seller_or_admin
// y order_items_select_buyer_seller_or_admin (Fase 2.3). No es
// reimplementar get_store_stats (regla #8 del enforcer): ese vive en
// mcp/ para el asistente de IA con el cliente admin (ve TODO, incluidos
// productos inactivos ajenos); este es un dashboard web con la sesión de
// un usuario real, con el alcance más chico que su rol ya le da por RLS
// — products_select_active_or_own NO tiene bypass de admin (decisión
// documentada en policies.sql), así que "productos activos" acá es
// literalmente "lo que ve cualquiera", no un conteo administrativo
// completo.
export interface PlatformStats {
  totalUsers: number;
  usersByRole: Record<UserRole, number>;
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  totalRevenue: number;
  activeProducts: number;
}

export async function getPlatformStats(supabase: Client = createClient()): Promise<PlatformStats> {
  const [profilesRes, ordersRes, productsRes] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("orders").select("status, total"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (productsRes.error) throw productsRes.error;

  const usersByRole: Record<UserRole, number> = { buyer: 0, seller: 0, admin: 0 };
  for (const row of profilesRes.data) {
    const role = row.role as UserRole;
    if (role in usersByRole) usersByRole[role] += 1;
  }

  const ordersByStatus: Record<OrderStatus, number> = {
    pendiente: 0,
    pagado: 0,
    enviado: 0,
    entregado: 0,
    cancelado: 0,
  };
  // total es numeric(12,2) -> string desde PostgREST (convención de la
  // Fase 3): se convierte acá, antes de que un componente lo reciba.
  // "cancelado" SÍ se suma al revenue de la tabla, pero se excluye del
  // total de ingresos reales — un pedido cancelado no generó ingreso.
  let totalRevenue = 0;
  for (const row of ordersRes.data) {
    const status = row.status as OrderStatus;
    if (status in ordersByStatus) ordersByStatus[status] += 1;
    if (status !== "cancelado") totalRevenue += Number(row.total);
  }

  return {
    totalUsers: profilesRes.data.length,
    usersByRole,
    totalOrders: ordersRes.data.length,
    ordersByStatus,
    totalRevenue,
    activeProducts: productsRes.count ?? 0,
  };
}

// profiles_select_own_or_admin ya deja que un admin lea CUALQUIER fila —
// sin filtro adicional acá, a propósito (el admin ve a todos, incluidos
// otros admins).
export async function listUsers(supabase: Client = createClient()): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  // avatar_url no se resuelve acá (a diferencia de auth.service.getSession):
  // esta lista es solo texto/rol, no muestra avatares — evita N llamadas a
  // getPublicUrl por cada fila para un dato que la UI no usa.
  return data.map((row) => ({ ...row, role: row.role as UserRole, avatar_url: null }));
}
