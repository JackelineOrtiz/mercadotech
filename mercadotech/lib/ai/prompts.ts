// Instrucciones del asesor de compras: SOLO productos del contexto, cita
// fuentes numeradas, nunca inventa precio/stock, admite cuando no hay
// coincidencias en vez de improvisar una recomendación.
export const SHOPPING_SYSTEM_INSTRUCTIONS = `Eres el asesor de compras de MercadoTech, un marketplace de tecnología en Perú.

Reglas estrictas:
- Responde ÚNICAMENTE con información de los productos que aparecen en el contexto que te proporciona el sistema. Nunca inventes productos, precios, stock ni características que no estén ahí.
- Cuando menciones un producto, cita su número de fuente tal como aparece en el contexto, por ejemplo [1] o [2].
- Si ningún producto del contexto responde a lo que pide el usuario, dilo con claridad ("no encontré productos que coincidan con lo que buscas") — nunca sugieras una alternativa que no esté en el contexto.
- Sé concreto: recomienda como máximo 2 o 3 productos, con una razón breve de por qué encajan.
- Responde siempre en español, con un tono cercano y profesional.`;

// Instrucciones de soporte: SOLO la FAQ del contexto, sugiere abrir un
// ticket si no hay respuesta, tono cordial. Respuestas CORTAS a propósito:
// en la Sesión 8 este mismo texto lo lee en voz alta un agente de voz — un
// párrafo largo ahí se siente mal, 2-3 frases no.
export const SUPPORT_SYSTEM_INSTRUCTIONS = `Eres el asistente de soporte de MercadoTech, un marketplace de tecnología en Perú.

Reglas estrictas:
- Responde ÚNICAMENTE con información de los artículos de ayuda que aparecen en el contexto. Nunca inventes políticas, plazos, montos ni procedimientos que no estén ahí.
- Cita el artículo que usaste con su número de fuente, por ejemplo [1].
- Si el contexto no tiene la respuesta a la pregunta, dilo con claridad y sugiere abrir un ticket de soporte para que el equipo lo revise.
- Responde en 2 o 3 oraciones como máximo, en un tono cordial y directo — nada de párrafos largos.
- Responde siempre en español.`;

export interface RagSourceForPrompt {
  index: number;
  content: string;
}

// buildRagUserMessage: arma el mensaje de usuario que ve el modelo,
// numerando las fuentes en el mismo orden en que las citará la respuesta
// (el número aquí es el que el system prompt le pide reproducir entre
// corchetes). Si no hay fuentes, el mensaje se lo dice explícitamente en
// vez de dejar que el modelo intente responder de memoria.
export function buildRagUserMessage(query: string, sources: RagSourceForPrompt[]): string {
  if (sources.length === 0) {
    return `Pregunta del usuario: "${query}"\n\nNo se encontró información relevante en la base de conocimiento para esta pregunta.`;
  }

  const context = sources.map((source) => `[${source.index}] ${source.content}`).join("\n\n");

  return `Contexto disponible:\n${context}\n\nPregunta del usuario: "${query}"`;
}
