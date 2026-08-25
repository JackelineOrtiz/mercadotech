export type ChatMode = "compras" | "soporte";

// Misma forma que ContextSource de lib/ai/context-builder.ts — se declara
// aparte porque types/ no debe depender de lib/ai/ (los tipos de dominio
// son la fuente de verdad de la forma, no al revés).
export interface ChatSource {
  index: number;
  source_type: "producto" | "articulo_soporte";
  source_id: string;
  title: string;
  similarity: number;
}

// Un turno de la conversación — historial en memoria del navegador (Fase
// 4.7, useChat), nunca persistido (fuera de alcance de la sesión).
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export interface ChatResult {
  query: string;
  answer: string;
  // false cuando ninguna ficha recuperada pasó el filtro del constructor
  // de contexto — la UI lo usa para decidir si vale la pena mostrar
  // "fuentes" o solo la respuesta (que en ese caso admite que no sabe).
  hasRelevantContext: boolean;
  sources: ChatSource[];
  metadata: {
    model: string;
    retrievedCount: number;
    usedSourceCount: number;
    contextTruncated: boolean;
  };
}
