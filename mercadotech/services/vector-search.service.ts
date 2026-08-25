import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";
import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  PRODUCT_SELECT,
  mapProduct,
  type ProductQueryRow,
} from "@/services/product.service";
import {
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
} from "@/lib/constants/ai";

type Client = SupabaseClient<Database>;
type SourceType = "producto" | "articulo_soporte";

// Igual que embedding.service.ts (Fase 4.2): sin default de cliente. Este
// service SIEMPRE se llama desde un Route Handler con el cliente de SESIÓN
// (no el admin) — la RLS de knowledge_embeddings (solo authenticated) y de
// products deben aplicar con la identidad real del que busca.
export interface KnowledgeMatch {
  source_type: SourceType;
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface VectorSearchOptions {
  sourceType?: SourceType;
  topK?: number;
  threshold?: number;
}

// Mismo formato que embedding.service.ts al escribir — aquí se usa para
// pasarle el embedding de la CONSULTA al RPC (match_knowledge espera
// vector(384), PostgREST lo recibe como este texto).
function vectorToPgvector(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function searchByEmbedding(
  embedding: number[],
  opts: VectorSearchOptions,
  supabase: Client,
): Promise<KnowledgeMatch[]> {
  const { data, error } = await supabase.rpc("match_knowledge", {
    query_embedding: vectorToPgvector(embedding),
    // undefined (no null): supabase-js omite la clave del body y Postgres
    // usa el propio default de la función (p_source_type ... default
    // null, "busca en ambas fuentes") — el tipo generado del RPC es
    // `string | undefined`, no admite null explícito.
    p_source_type: opts.sourceType,
    match_count: opts.topK ?? VECTOR_SEARCH_DEFAULT_TOP_K,
    similarity_threshold: opts.threshold ?? VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  });
  if (error) throw error;
  return data as KnowledgeMatch[];
}

export type ProductWithSimilarity = Product & { similarity: number };

// searchByEmbedding solo sabe de knowledge_embeddings — no tiene precio,
// stock ni imagen actuales, ni sabe si el producto se desactivó o se borró
// desde que se fichó. Se hidrata contra products (mismo PRODUCT_SELECT/
// mapProduct que product.service, misma convención de image_url resuelta)
// y se filtra is_active explícito: un match de un producto borrado o
// desactivado simplemente no aparece en el resultado (huérfanos
// descartados, decisión 6 de la spec).
export async function searchProducts(
  query: string,
  opts: Omit<VectorSearchOptions, "sourceType">,
  supabase: Client,
): Promise<ProductWithSimilarity[]> {
  const embedding = await generateEmbedding(query);
  const matches = await searchByEmbedding(embedding, { ...opts, sourceType: "producto" }, supabase);
  if (matches.length === 0) return [];

  const productIds = matches.map((m) => m.source_id);
  const { data: products, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", productIds)
    .eq("is_active", true)
    .returns<ProductQueryRow[]>();
  if (error) throw error;

  const similarityBySourceId = new Map(matches.map((m) => [m.source_id, m.similarity]));

  return products
    .map((row) => {
      const product = mapProduct(row);
      return { ...product, similarity: similarityBySourceId.get(product.id)! };
    })
    // El JOIN contra products no conserva el orden de match_knowledge —
    // se reordena por similitud para que el más relevante siga primero.
    .sort((a, b) => b.similarity - a.similarity);
}
