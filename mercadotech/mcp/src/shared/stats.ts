import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Category } from "@/types/product";
import { listCategories } from "@/services/category.service";
import { listActiveProducts, getProductsByIds } from "@/services/product.service";

type Client = SupabaseClient<Database>;

// Derivaciones de agregados (lección 6 de la Guía): NINGUNA de estas dos
// existe como service — en vez de agregar una consulta de negocio nueva
// "porque era más corto", se COMPONEN los services reales que ya existen.
// Las usan la tool #3 (list_categories) y la #9 (get_store_stats).

export interface CategoryWithCount extends Category {
  productCount: number;
}

// N+1 consultas (una por categoría) a propósito: reutiliza
// listActiveProducts tal cual (con su count exacto de PostgREST vía
// { count: "exact" }) en vez de escribir un GROUP BY nuevo — el catálogo
// tiene pocas categorías (seed: 6), el costo es despreciable.
export async function getCategoriesWithCount(supabase: Client): Promise<CategoryWithCount[]> {
  const categories = await listCategories(supabase);
  const counts = await Promise.all(
    categories.map((category) => listActiveProducts({ categorySlug: category.slug }, supabase)),
  );
  return categories.map((category, i) => ({ ...category, productCount: counts[i].total }));
}

export interface TopSellingProduct {
  productId: string;
  title: string;
  unitsSold: number;
}

// order_items no es legible con anon (RLS: solo comprador/vendedor/admin
// de ese pedido) — requiere el cliente admin, igual que get_order_status
// (decisión 4 de la spec). Se hidratan los títulos con el MISMO admin
// (no anon) a propósito: un producto puede haberse desactivado desde que
// se vendió y products_select_active_or_own lo ocultaría a anon — un "top
// vendidos" histórico debe poder seguir mostrándolo.
export async function getTopSellingProducts(
  admin: Client,
  limit: number,
): Promise<TopSellingProduct[]> {
  const { data, error } = await admin.from("order_items").select("product_id, quantity");
  if (error) throw error;

  const unitsByProduct = new Map<string, number>();
  for (const row of data) {
    unitsByProduct.set(row.product_id, (unitsByProduct.get(row.product_id) ?? 0) + row.quantity);
  }

  const topIds = [...unitsByProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([productId]) => productId);
  if (topIds.length === 0) return [];

  const products = await getProductsByIds(topIds, admin);
  const productsById = new Map(products.map((p) => [p.id, p]));

  // Preserva el orden por unidades vendidas (getProductsByIds no lo
  // garantiza); si un producto se borró físicamente (no solo desactivado)
  // desde la venta, simplemente no aparece — order_items sobrevive por su
  // "on delete restrict" con products (Fase 2.2), así que este caso no
  // debería darse en la práctica.
  return topIds
    .map((productId) => {
      const product = productsById.get(productId);
      if (!product) return null;
      return { productId, title: product.title, unitsSold: unitsByProduct.get(productId)! };
    })
    .filter((p): p is TopSellingProduct => p !== null);
}

const TOP_SELLING_LIMIT = 5;

export interface StoreStats {
  totalActiveProducts: number;
  categories: CategoryWithCount[];
  topSelling: TopSellingProduct[];
}

// Composición de las dos derivaciones de arriba + el total de productos
// activos — compartida entre la tool get_store_stats (5.3) y el resource
// mercadotech://stats (5.4), misma forma exacta en ambos.
export async function getStoreStats(anon: Client, admin: Client): Promise<StoreStats> {
  const [{ total: totalActiveProducts }, categories, topSelling] = await Promise.all([
    listActiveProducts({}, anon),
    getCategoriesWithCount(anon),
    getTopSellingProducts(admin, TOP_SELLING_LIMIT),
  ]);
  return { totalActiveProducts, categories, topSelling };
}
