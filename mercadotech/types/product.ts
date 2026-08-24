import type { Database } from "@/types/database";
import type { ProductCondition } from "@/lib/constants/roles";

// numeric(12,2) llega como string desde PostgREST; los services lo
// convierten a number antes de exponerlo como Product. "condition" también
// se estrecha al literal union real (la columna es solo `text` a nivel de
// tipos generados, el check constraint vive en la base).
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  price: number;
  condition: ProductCondition;
  image_url: string | null;
  average_rating: number | null;
  review_count: number;
};

export type ProductImage = Database["public"]["Tables"]["product_images"]["Row"] & {
  image_url: string;
};

export type Category = Database["public"]["Tables"]["categories"]["Row"];
