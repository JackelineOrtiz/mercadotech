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
}

// Forma real de la fila que devuelve el select anidado — product_images y
// reviews vienen como arreglos sin ordenar/agregar; mapProduct() es lo único
// que los toca antes de que un componente los vea.
type ProductQueryRow = Database["public"]["Tables"]["products"]["Row"] & {
  product_images: Pick<
    Database["public"]["Tables"]["product_images"]["Row"],
    "image_path" | "position"
  >[];
  reviews: Pick<Database["public"]["Tables"]["reviews"]["Row"], "rating">[];
};

const PRODUCT_SELECT = "*, product_images(image_path, position), reviews(rating)";

function mapProduct(row: ProductQueryRow): Product {
  const { product_images, reviews, ...rest } = row;

  const cover = [...product_images].sort((a, b) => a.position - b.position)[0];
  const ratings = reviews.map((r) => r.rating);
  const averageRating =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;

  return {
    ...rest,
    price: Number(rest.price),
    condition: rest.condition as ProductCondition,
    image_url: cover ? getPublicUrl("product-images", cover.image_path) : null,
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

  return { items: data.map(mapProduct), total: count ?? 0 };
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
  return mapProduct(data);
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
    image_url: getPublicUrl("product-images", image.image_path),
  }));
}
