import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// Nace aquí con SOLO esto (decisión 4 de la spec): las imágenes se muestran
// desde la Fase 3.4, pero subir/borrar/reordenar es del vendedor y llega
// recién en la Fase 3.7 — se amplía este mismo archivo entonces, no se crea
// uno nuevo.
export function getPublicUrl(
  bucket: string,
  path: string,
  supabase: Client = createClient(),
): string {
  // Bug real de seed.sql (Fase 2.5): image_path se guardó como
  // "product-images/{seller_id}/{product_id}/{n}.jpg" — con el nombre del
  // bucket concatenado por error, aunque el propio comentario del seed dice
  // "sin el nombre del bucket". No se puede tocar seed.sql en esta sesión
  // (regla transversal), así que se sanea aquí: sin esto, la URL queda
  // duplicada (".../public/product-images/product-images/...") y la imagen
  // nunca carga. Cubre tanto los datos actuales como paths ya bien
  // formados que suba el vendedor en la Fase 3.7.
  const normalizedPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const { data } = supabase.storage.from(bucket).getPublicUrl(normalizedPath);
  return data.publicUrl;
}
