import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChatHistoryTurn, ChatMode, ChatResult } from "@/types/chat";
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

// Fase 7.5, hallazgo real (subagente: 18 hilos reales con réplicas, 16
// con al menos un problema): con historial, la búsqueda de CADA réplica
// se hacía solo con el texto de esa réplica — "¿cuál de esas dos es más
// liviana?" no tiene ningún término de producto, así que la búsqueda
// semántica traía fichas random no relacionadas, y el modelo terminaba
// respondiendo sobre ESAS en vez de usar el historial (ej. real: "cuál
// de esas dos" sobre dos laptops recomendadas terminó comparando una
// consola de videojuegos contra una silla gamer). Fix: la QUERY QUE SE
// EMBEBE para buscar combina el/los último(s) turno(s) reales de la
// conversación (donde suele estar el nombre real del producto, porque el
// propio asistente lo dijo en su respuesta anterior) con la pregunta
// actual. Nunca se usa esta combinación como el "query" que ve el
// usuario ni como el mensaje que recibe el modelo — solo alimenta el
// embedding de búsqueda.
const RETRIEVAL_HISTORY_TURNS = 2;

function buildRetrievalQuery(query: string, history: ChatHistoryTurn[]): string {
  if (history.length === 0) return query;
  const recent = history.slice(-RETRIEVAL_HISTORY_TURNS).map((turn) => turn.content);
  return [...recent, query].join("\n");
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
  // Fase 7.5, hallazgo real: no existía NINGÚN parámetro de historial —
  // cada mensaje era una consulta independiente, aunque la UI mostrara
  // una conversación continua. El route handler ya lo recorta a
  // CHAT_HISTORY_MAX_TURNS antes de llegar acá.
  history: ChatHistoryTurn[] = [],
): Promise<ChatResult> {
  const sourceType = mode === "compras" ? "producto" : "articulo_soporte";
  const systemInstructions =
    mode === "compras" ? SHOPPING_SYSTEM_INSTRUCTIONS : SUPPORT_SYSTEM_INSTRUCTIONS;

  const retrievalQuery = buildRetrievalQuery(query, history);
  const embedding = await generateEmbedding(retrievalQuery);
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

  // El atajo sin-modelo (ver NO_CONTEXT_ANSWER) solo aplica quesin
  // historial: una réplica dentro de una conversación existente ("¿esa
  // tiene buena batería?") retrieva vacío A PROPÓSITO — es demasiado vaga
  // para matchear nada por sí sola — pero el modelo SÍ puede responderla
  // con lo ya establecido en los turnos previos. Sin historial, un
  // contexto vacío es indistinguible de "no hay nada relevante en serio",
  // ahí sigue rigiendo el corte determinístico (Fase 7.5, hallazgo previo:
  // el modelo alucinaba en vez de admitir que no sabía).
  if (context.sources.length === 0 && history.length === 0) {
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

  const completion = await generateCompletion(systemInstructions, context.userMessage, history);

  return {
    query,
    answer: completion.text,
    // Real, no hardcodeado: en una réplica con historial y cero fuentes
    // NUEVAS, sigue siendo false — el cliente no debería mostrar una
    // sección "Fuentes" vacía como si hubiera citado algo.
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
