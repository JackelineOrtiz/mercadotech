import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChatMode, ChatResult } from "@/types/chat";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { generateCompletion } from "@/lib/ai/completion";
import { SHOPPING_SYSTEM_INSTRUCTIONS, SUPPORT_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";
import { buildContext } from "@/lib/ai/context-builder";
import { searchByEmbedding } from "@/services/vector-search.service";

type Client = SupabaseClient<Database>;

export interface AskOptions {
  topK?: number;
  similarityThreshold?: number;
  maxSources?: number;
  maxContextChars?: number;
}

// Igual que embedding.service.ts/vector-search.service.ts: sin default de
// cliente — siempre se llama desde el Route Handler con el cliente de
// SESIÓN, para que la búsqueda respete la RLS de knowledge_embeddings.
//
// ask() orquesta SIN reimplementar nada de las capas dueñas: no sabe cómo
// se genera un embedding (lib/ai/embeddings), ni la forma de la tabla
// (vector-search.service), ni cómo se arma el contexto
// (lib/ai/context-builder), ni cómo se habla con el proveedor de chat
// (lib/ai/completion). Si algo de eso cambia, se toca esa capa, no esta.
export async function ask(
  query: string,
  mode: ChatMode,
  opts: AskOptions,
  supabase: Client,
): Promise<ChatResult> {
  const sourceType = mode === "compras" ? "producto" : "articulo_soporte";
  const systemInstructions =
    mode === "compras" ? SHOPPING_SYSTEM_INSTRUCTIONS : SUPPORT_SYSTEM_INSTRUCTIONS;

  const embedding = await generateEmbedding(query);
  const matches = await searchByEmbedding(
    embedding,
    { sourceType, topK: opts.topK, threshold: opts.similarityThreshold },
    supabase,
  );

  const context = buildContext(query, matches, {
    maxSources: opts.maxSources,
    minSimilarity: opts.similarityThreshold,
    maxContextChars: opts.maxContextChars,
  });

  const completion = await generateCompletion(systemInstructions, context.userMessage);

  return {
    query,
    answer: completion.text,
    hasRelevantContext: context.sources.length > 0,
    sources: context.sources,
    metadata: {
      model: completion.model,
      retrievedCount: matches.length,
      usedSourceCount: context.sources.length,
      contextTruncated: context.stats.contextTruncated,
    },
  };
}
