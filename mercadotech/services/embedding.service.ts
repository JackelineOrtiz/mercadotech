import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  buildProductEmbeddingText,
  buildSupportArticleEmbeddingText,
  generateEmbedding,
} from "@/lib/ai/embeddings";
import { getProductById } from "@/services/product.service";

type Client = SupabaseClient<Database>;
type SourceType = "producto" | "articulo_soporte";

// A diferencia del resto de services (Sesión 3), sin default = createClient():
// este service SOLO escribe en knowledge_embeddings, que no tiene política
// de INSERT/UPDATE para authenticated (Fase 4.1) — el caller SIEMPRE debe
// inyectar el cliente admin (Route Handler o scripts/), nunca el de
// navegador. Que el parámetro no tenga default es intencional, no un olvido.

// pgvector expone `embedding` como texto por PostgREST (types/database.ts:
// Row.embedding es `string`) — este es el único lugar que serializa un
// number[] al formato "[0.1,0.2,...]" que Postgres interpreta como vector.
function vectorToPgvector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

// Reutiliza getProductById (product.service, Fase 3.4) en vez de un select
// propio: además de ahorrar duplicar el mapeo numeric->number, así la
// ficha guarda el mismo image_url YA RESUELTO que ve el catálogo — sin
// esto, las fuentes citadas en el chat (Fase 4.7) no tendrían de dónde
// sacar una imagen para su mini-card. getProductById no filtra por
// is_active, así que reindexar un producto recién desactivado sigue
// funcionando (su ficha se actualiza igual, decisión de la Fase 4.1: la
// ficha no se borra al desactivar, solo al eliminar).
export async function indexProduct(productId: string, supabase: Client): Promise<void> {
  const product = await getProductById(productId, supabase);

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("name")
    .eq("id", product.category_id)
    .single();
  if (categoryError) throw categoryError;

  const content = buildProductEmbeddingText(
    {
      title: product.title,
      brand: product.brand,
      condition: product.condition,
      description: product.description,
    },
    { name: category.name },
  );
  const embedding = await generateEmbedding(content);

  const { error } = await supabase.from("knowledge_embeddings").upsert(
    {
      source_type: "producto" satisfies SourceType,
      source_id: product.id,
      chunk_index: 0,
      content,
      embedding: vectorToPgvector(embedding),
      metadata: {
        title: product.title,
        price: product.price,
        category: category.name,
        image_url: product.image_url,
      },
    },
    { onConflict: "source_type,source_id,chunk_index" },
  );
  if (error) throw error;
}

export async function indexSupportArticle(articleId: string, supabase: Client): Promise<void> {
  const { data: article, error: articleError } = await supabase
    .from("support_articles")
    .select("id, title, content, category")
    .eq("id", articleId)
    .single();
  if (articleError) throw articleError;

  const content = buildSupportArticleEmbeddingText({
    title: article.title,
    category: article.category,
    content: article.content,
  });
  const embedding = await generateEmbedding(content);

  const { error } = await supabase.from("knowledge_embeddings").upsert(
    {
      source_type: "articulo_soporte" satisfies SourceType,
      source_id: article.id,
      chunk_index: 0,
      content,
      embedding: vectorToPgvector(embedding),
      metadata: { title: article.title, category: article.category },
    },
    { onConflict: "source_type,source_id,chunk_index" },
  );
  if (error) throw error;
}

// Punto de entrada único para el endpoint de reindexado (Fase 4.3), que
// recibe sourceType como string desde el body del POST.
export async function indexSource(
  sourceType: SourceType,
  sourceId: string,
  supabase: Client,
): Promise<void> {
  if (sourceType === "producto") {
    await indexProduct(sourceId, supabase);
  } else {
    await indexSupportArticle(sourceId, supabase);
  }
}

// PGRST116 = PostgREST "0 filas" en un .single() — es lo que devuelve
// indexProduct/indexSupportArticle cuando la fuente ya no existe (producto
// borrado). El Route Handler de reindexado (Fase 4.3) usa esto para decidir
// entre reintentar como error real o limpiar la ficha huérfana, sin tener
// que conocer el código de error de Postgrest él mismo.
export function isSourceNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "PGRST116"
  );
}

// Borra la(s) ficha(s) de una fuente que ya no existe — la FK ausente de
// source_id (Fase 4.1) hace posible que quede huérfana, esto la limpia.
export async function removeEmbeddings(
  sourceType: SourceType,
  sourceId: string,
  supabase: Client,
): Promise<void> {
  const { error } = await supabase
    .from("knowledge_embeddings")
    .delete()
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);
  if (error) throw error;
}
