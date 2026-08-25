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

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// La extensión sale del MIME real, no del nombre de archivo: un usuario
// puede renombrar "foto.png" a "foto.jpg", y el bucket valida el MIME, no
// la extensión — el path debe coincidir con lo que Storage realmente
// aceptó, o getPublicUrl no encontrará el objeto después.
export async function uploadProductImage(
  file: File,
  sellerId: string,
  productId: string,
  n: number,
  supabase: Client = createClient(),
): Promise<string> {
  const ext = EXT_BY_MIME[file.type] ?? "jpg";
  const path = `${sellerId}/${productId}/${n}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    upsert: true,
  });
  if (error) throw error;
  return path;
}

// Borra el objeto en Storage y su fila en product_images en el mismo
// llamado — el vendedor nunca deja una imagen "huérfana" en un solo lado.
// Se matchea por image_path (no por id): mismo valor que devolvió
// uploadProductImage y que ya tiene el service en memoria, sin ida y
// vuelta extra a la base para resolver un id.
export async function deleteProductImage(
  imagePath: string,
  supabase: Client = createClient(),
): Promise<void> {
  const normalizedPath = imagePath.startsWith("product-images/")
    ? imagePath.slice("product-images/".length)
    : imagePath;
  const { error: storageError } = await supabase.storage
    .from("product-images")
    .remove([normalizedPath]);
  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from("product_images")
    .delete()
    .eq("image_path", imagePath);
  if (dbError) throw dbError;
}

export interface ImageOrderItem {
  id: string;
  product_id: string;
  image_path: string;
  position: number;
}

// Upsert con filas COMPLETAS (id, product_id, image_path, position): un
// upsert parcial (solo id+position) dejaría product_id/image_path en null
// en una fila nueva y violaría los not null de la tabla. Sirve para tres
// casos de la Fase 3.7 (todos con la misma forma: escribir N filas de
// product_images de una vez): alta inicial al publicar, reorden en modo
// edición, y alta de una imagen nueva agregada durante la edición — en los
// tres, el id ya lo generó el llamador (crypto.randomUUID()), así que un
// id inexistente simplemente se inserta.
export async function saveImageOrder(
  items: ImageOrderItem[],
  supabase: Client = createClient(),
): Promise<void> {
  if (items.length === 0) return;
  const { error } = await supabase.from("product_images").upsert(items);
  if (error) throw error;
}
