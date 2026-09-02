import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChatMode, ChatResult } from "@/types/chat";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { generateCompletion } from "@/lib/ai/completion";
import { SHOPPING_SYSTEM_INSTRUCTIONS, SUPPORT_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";
import { buildContext } from "@/lib/ai/context-builder";
import { searchByEmbedding } from "@/services/vector-search.service";

type Client = SupabaseClient<Database>;

// Fase 7.5, hallazgo real validando el asistente con datos reales: cuando
// la búsqueda semántica no encuentra NADA relevante (context.sources
// vacío), el modelo gratuito de Hugging Face no siempre respeta la regla
// del prompt de admitir que no sabe — en varios casos inventó productos,
// precios y hasta números de artículo de la FAQ que no existen, citándolos
// como si fueran reales. Ningún ajuste de prompt lo garantiza al 100% con
// un modelo así. Corte determinístico: si no hay NINGUNA fuente, ni
// siquiera se llama al modelo — se responde con un mensaje fijo, cero
// posibilidad de alucinar porque no hay generación de por medio.
const NO_CONTEXT_ANSWER: Record<ChatMode, string> = {
  compras:
    "No encontré productos en el catálogo que coincidan con lo que buscas. Probá con otros términos o describime para qué lo necesitas.",
  soporte:
    "No tengo información sobre esto en los artículos de ayuda disponibles. Te recomiendo abrir un ticket de soporte para que el equipo lo revise.",
};

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

  if (context.sources.length === 0) {
    return {
      query,
      answer: NO_CONTEXT_ANSWER[mode],
      hasRelevantContext: false,
      sources: [],
      metadata: {
        model: "n/a (sin contexto, no se llamó al modelo)",
        retrievedCount: matches.length,
        usedSourceCount: 0,
        contextTruncated: false,
      },
    };
  }

  const completion = await generateCompletion(systemInstructions, context.userMessage);

  return {
    query,
    answer: completion.text,
    hasRelevantContext: true,
    sources: context.sources,
    metadata: {
      model: completion.model,
      retrievedCount: matches.length,
      usedSourceCount: context.sources.length,
      contextTruncated: context.stats.contextTruncated,
    },
  };
}
