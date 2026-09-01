import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product, ProductImage } from "@/types/product";
import type { ProductCondition } from "@/lib/constants/roles";
import { PRODUCTS_PAGE_SIZE, type SortOption } from "@/lib/constants/catalog";
import { getPublicUrl } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

export interface ProductFilters {
  categorySlug?: string;
  search?: string;
  condition?: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  page?: number;
  // Fuera del PDF de la spec: storefront público del vendedor
  // (/tienda/[sellerId]) — reusa este mismo filtro en vez de una query
  // aparte, is_active sigue aplicándose igual que en el catálogo normal.
  sellerId?: string;
}

// Forma real de la fila que devuelve el select anidado — product_images y
// reviews vienen como arreglos sin ordenar/agregar; mapProduct() es lo único
// que los toca antes de que un componente los vea. Se exporta junto con el
// select porque favorite.service.ts (Fase 3.5) hace el mismo join anidado
// vía favorites->products y reutiliza este mapeo en vez de duplicarlo.
export type ProductQueryRow = Database["public"]["Tables"]["products"]["Row"] & {
  product_images: Pick<
    Database["public"]["Tables"]["product_images"]["Row"],
    "image_path" | "position"
  >[];
  reviews: Pick<Database["public"]["Tables"]["reviews"]["Row"], "rating">[];
};

export const PRODUCT_SELECT = "*, product_images(image_path, position), reviews(rating)";

// supabase opcional (default = cliente de navegador): SIEMPRE pasarlo
// explícito cuando el caller ya tiene uno inyectado (ej. el cliente admin
// en embedding.service.ts) — omitirlo hace que getPublicUrl construya su
// propio cliente de navegador con el default, y ese default explota fuera
// del navegador ("Node.js detected but native WebSocket not found",
// encontrado real reindexando desde scripts/index-all.ts en la Fase 4.7).
// getPublicUrl no hace red (solo arma un string), pero igual necesita una
// instancia de cliente para llamarlo.
export function mapProduct(row: ProductQueryRow, supabase?: Client): Product {
  const { product_images, reviews, ...rest } = row;

  const cover = [...product_images].sort((a, b) => a.position - b.position)[0];
  const ratings = reviews.map((r) => r.rating);
  const averageRating =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

  return {
    ...rest,
    price: Number(rest.price),
    condition: rest.condition as ProductCondition,
    image_url: cover ? getPublicUrl("product-images", cover.image_path, supabase) : null,
    average_rating: averageRating,
    review_count: ratings.length,
  };
}

export async function listActiveProducts(
  filters: ProductFilters = {},
  supabase: Client = createClient(),
): Promise<{ items: Product[]; total: number }> {
  const page = filters.page ?? 1;
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT, { count: "exact" })
    // Explícito aunque RLS ya lo garantice para anon: sin esto, un
    // vendedor logueado vería sus propios productos inactivos en el
    // catálogo público (products_select_active_or_own también deja pasar
    // "o soy el dueño").
    .eq("is_active", true);

  if (filters.sellerId) {
    query = query.eq("seller_id", filters.sellerId);
  }

  if (filters.categorySlug) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", filters.categorySlug)
      .single();
    if (categoryError) throw categoryError;
    query = query.eq("category_id", category.id);
  }

  if (filters.search) {
    // Provisional hasta la búsqueda semántica de la sesión 4.
    const term = `%${filters.search}%`;
    query = query.or(`title.ilike.${term},brand.ilike.${term}`);
  }

  if (filters.condition && filters.condition.length > 0) {
    query = query.in("condition", filters.condition);
  }

  if (filters.minPrice !== undefined) {
    query = query.gte("price", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte("price", filters.maxPrice);
  }

  switch (filters.sort) {
    case "precio_asc":
      query = query.order("price", { ascending: true });
      break;
    case "precio_desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query
    .range(from, to)
    .returns<ProductQueryRow[]>();
  if (error) throw error;

  return { items: data.map((row) => mapProduct(row, supabase)), total: count ?? 0 };
}

export async function getProductById(
  id: string,
  supabase: Client = createClient(),
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .single()
    .returns<ProductQueryRow>();
  if (error) throw error;
  return mapProduct(data, supabase);
}

// Versión plural de getProductById — mismo criterio (sin filtro explícito
// de is_active: RLS ya lo garantiza para anon vía products_select_active_
// or_own; con el cliente admin, deliberadamente NO se filtra, para que
// llamadores que lo necesiten — ej. estadísticas de ventas históricas —
// puedan incluir productos discontinuados). Agregada en la Fase 5.3: la
// spec de la sesión 5 la daba por existente (compare_products), pero no
// estaba — services/ es el lugar correcto para agregarla (reutilizable por
// toda la app, no solo por mcp/), no una reimplementación dentro de mcp/.
export async function getProductsByIds(
  ids: string[],
  supabase: Client = createClient(),
): Promise<Product[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", ids)
    .returns<ProductQueryRow[]>();
  if (error) throw error;
  return data.map((row) => mapProduct(row, supabase));
}

export async function getProductImages(
  productId: string,
  supabase: Client = createClient(),
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("position");
  if (error) throw error;

  return data.map((image) => ({
    ...image,
    image_url: getPublicUrl("product-images", image.image_path, supabase),
  }));
}

// product_views_insert_own exige authenticated + user_id = auth.uid() —
// solo se llama cuando hay sesión (lo decide el hook, no este service).
// Fire-and-forget: el llamador debe atrapar el error, no debe romper la
// pantalla de producto si esto falla.
export async function registerView(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("product_views")
    .insert({ product_id: productId, user_id: userId });
  if (error) throw error;
}
