import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";
import { PRODUCT_SELECT, mapProduct, type ProductQueryRow } from "@/services/product.service";

type Client = SupabaseClient<Database>;

export async function isFavorite(
  userId: string,
  productId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Permitido por favorites_insert_own/favorites_delete_own:
// (select auth.uid()) = user_id. Devuelve el nuevo estado para que el hook
// no tenga que adivinarlo.
export async function toggle(
  userId: string,
  productId: string,
  supabase: Client = createClient(),
): Promise<boolean> {
  const currentlyFavorite = await isFavorite(userId, productId, supabase);

  if (currentlyFavorite) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: userId, product_id: productId });
  if (error) throw error;
  return true;
}

type FavoriteQueryRow = {
  products: ProductQueryRow | null;
};

// Join a products (mismo select anidado y mapeo que product.service.ts)
// para mostrar cards completas en /favoritos. products puede venir null:
// si el producto se volvió inactivo después de marcarlo favorito, RLS
// oculta la fila embebida para cualquiera que no sea el dueño — no es un
// error, solo se filtra.
export async function listMine(
  userId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select(`products(${PRODUCT_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<FavoriteQueryRow[]>();
  if (error) throw error;

  return data
    .filter((row): row is { products: ProductQueryRow } => row.products !== null)
    .map((row) => mapProduct(row.products, supabase));
}
