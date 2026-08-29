import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { listMyProducts } from "@/services/seller.service";

type Client = SupabaseClient<Database>;

export interface SellerProfile {
  displayName: string | null;
  products: { id: string; title: string; price: number }[];
}

// Derivación nueva (lección 6): ningún service existente expone
// "perfil público de un vendedor" — profiles no tiene SELECT público
// (decisión 5, RLS de la Fase 2.3), así que la web NUNCA necesitó
// resolver un display_name por id; esta es la primera vez que algo lo
// pide. La query a profiles es mínima y a propósito PLANA (una sola
// columna) — jamás select("*"): ni aquí ni en ningún llamador debe poder
// filtrarse phone/role por accidente si esta función se reutiliza.
//
// Los productos SÍ reutilizan un service real (seller.service.listMyProducts,
// Fase 3.7) — que devuelve activos E inactivos del vendedor (a propósito,
// para que el vendedor los reactive) — se filtra a activos acá, porque
// este resource es público y solo debe mostrar lo que un comprador vería.
export async function getSellerProfile(
  sellerId: string,
  admin: Client,
): Promise<SellerProfile | null> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", sellerId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const allProducts = await listMyProducts(sellerId, admin);
  const activeProducts = allProducts
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, title: p.title, price: p.price }));

  return { displayName: profile.display_name, products: activeProducts };
}
