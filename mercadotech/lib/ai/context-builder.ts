import { buildRagUserMessage } from "@/lib/ai/prompts";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS,
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

// Forma mínima de una ficha recuperada — coincide estructuralmente con
// KnowledgeMatch de vector-search.service.ts, pero se declara aparte a
// propósito: lib/ai/ no importa de services/ (esa dependencia va al
// revés en toda la sesión — services importan de lib/ai/, nunca al
// contrario) ni de nada que toque Supabase.
export interface ContextCandidate {
  source_type: "producto" | "articulo_soporte";
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface ContextBuilderOptions {
  maxSources?: number;
  minSimilarity?: number;
  maxContextChars?: number;
}

export interface ContextSource {
  // Índice 1-based: es el número que buildRagUserMessage imprime entre
  // corchetes y el que el system prompt le pide al modelo reproducir — la
  // UI (Fase 4.7) convierte cada uno en un enlace, en el mismo orden.
  index: number;
  source_type: "producto" | "articulo_soporte";
  source_id: string;
  title: string;
  similarity: number;
}

export interface ContextBuilderResult {
  userMessage: string;
  sources: ContextSource[];
  stats: {
    contextTruncated: boolean;
    totalChars: number;
  };
}

function extractTitle(metadata: Record<string, unknown>): string {
  return typeof metadata.title === "string" ? metadata.title : "";
}

// buildContext: función PURA — cero red, cero Supabase, cero React. Todo
// lo que necesita entra por parámetros; todo lo que produce sale por el
// valor de retorno. Por eso es 100% testeable en aislamiento (Sesión 6).
//
// (1) Selección: descarta lo que está bajo minSimilarity o tiene menos de
//     CONTEXT_BUILDER_MIN_CONTENT_LENGTH caracteres de contenido (una
//     ficha casi vacía no aporta aunque su similitud sea alta), ordena por
//     similitud descendente y corta a maxSources.
// (2) Presupuesto: acumula contenido hasta maxContextChars. Si a una
//     fuente le sobra pero no cabe entera, se descarta ENTERA en vez de
//     truncarla a la mitad — salvo que el espacio que quede alcance para
//     un fragmento útil (CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS), en
//     cuyo caso se incluye truncada. En ambos casos deja de haber espacio
//     útil para las fuentes siguientes, así que el recorte termina ahí.
export function buildContext(
  query: string,
  results: ContextCandidate[],
  opts: ContextBuilderOptions = {},
): ContextBuilderResult {
  const maxSources = opts.maxSources ?? CONTEXT_BUILDER_DEFAULT_MAX_SOURCES;
  const minSimilarity = opts.minSimilarity ?? CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY;
  const maxContextChars = opts.maxContextChars ?? CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS;

  const eligible = results
    .filter(
      (r) => r.similarity >= minSimilarity && r.content.length >= CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
    )
    .sort((a, b) => b.similarity - a.similarity);
  const selected = eligible.slice(0, maxSources);

  const included: ContextCandidate[] = [];
  let totalChars = 0;
  // Truncado también si había más candidatos válidos que maxSources —
  // quedaron fuera por el límite de fuentes, no solo por el presupuesto de
  // caracteres. El loop de abajo puede volver a poner esto en true por la
  // otra razón (se queda sin espacio); ya es true, no hace daño.
  let contextTruncated = eligible.length > selected.length;

  for (const candidate of selected) {
    const remaining = maxContextChars - totalChars;
    if (remaining <= 0) {
      contextTruncated = true;
      break;
    }

    if (candidate.content.length <= remaining) {
      included.push(candidate);
      totalChars += candidate.content.length;
      continue;
    }

    if (remaining >= CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS) {
      const truncatedContent = candidate.content.slice(0, remaining);
      included.push({ ...candidate, content: truncatedContent });
      totalChars += truncatedContent.length;
    }
    contextTruncated = true;
    break;
  }

  const sources: ContextSource[] = included.map((candidate, i) => ({
    index: i + 1,
    source_type: candidate.source_type,
    source_id: candidate.source_id,
    title: extractTitle(candidate.metadata),
    similarity: candidate.similarity,
  }));

  const userMessage = buildRagUserMessage(
    query,
    included.map((candidate, i) => ({ index: i + 1, content: candidate.content })),
  );

  return { userMessage, sources, stats: { contextTruncated, totalChars } };
}
