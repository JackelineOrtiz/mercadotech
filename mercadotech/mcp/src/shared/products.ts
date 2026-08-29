import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getProductById, getProductImages, listActiveProducts } from "@/services/product.service";
import { getAverage } from "@/services/review.service";
import { listByProduct } from "@/services/question.service";
import { listCategories } from "@/services/category.service";

type Client = SupabaseClient<Database>;

// Compartido entre la tool get_product (5.3) y el resource
// mercadotech://products/{id} (5.4) — la spec pide que el resource use
// "la misma forma que la tool #2, misma función compartida" en vez de
// duplicar las 3 llamadas. Deja que el caller decida cómo envolver un
// "no encontrado" (la tool lo traduce a NotFoundError; el resource, a
// contenido de error legible vía safeRead) — por eso esto NO atrapa
// errores, los deja subir tal cual.
export async function getProductDetail(productId: string, supabase: Client) {
  const product = await getProductById(productId, supabase);
  const [images, rating, questions] = await Promise.all([
    getProductImages(productId, supabase),
    getAverage(productId, supabase),
    listByProduct(productId, supabase),
  ]);
  return { product, images, rating, questions };
}

export interface ProductSummary {
  id: string;
  title: string;
  price: number;
  category: string | null;
}

// Para mercadotech://products (resumen: id, título, precio, categoría) —
// listActiveProducts pagina de a PRODUCTS_PAGE_SIZE (12); un resource de
// "todo el catálogo" recorre las páginas hasta agotar `total`, reutilizando
// listActiveProducts tal cual (mismo criterio que getCategoriesWithCount
// en shared/stats.ts: N+1 aceptable con un catálogo chico, en vez de una
// query nueva sin paginar).
export async function getAllActiveProductsSummary(supabase: Client): Promise<ProductSummary[]> {
  const categories = await listCategories(supabase);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const summaries: ProductSummary[] = [];
  let page = 1;
  while (true) {
    const { items, total } = await listActiveProducts({ page }, supabase);
    for (const product of items) {
      summaries.push({
        id: product.id,
        title: product.title,
        price: product.price,
        category: categoryNameById.get(product.category_id) ?? null,
      });
    }
    if (summaries.length >= total || items.length === 0) break;
    page++;
  }
  return summaries;
}
