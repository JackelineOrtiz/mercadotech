import { HUGGINGFACE_CHAT_MAX_TOKENS, HUGGINGFACE_CHAT_MODEL_DEFAULT } from "@/lib/constants/ai";

const CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";

export interface CompletionResult {
  text: string;
  model: string;
  stopReason: string;
}

// generateCompletion: SOLO fetch al router OpenAI-compatible, nunca el SDK
// — a diferencia de embeddings.ts, chat completion SÍ está disponible ahí
// (Guía HF, lección 2). Errores distintos, mensajes distintos (lección 8):
// 401 = token; "model not supported"/"no provider" = el modelo rotó;
// respuesta sin choices = respuesta inválida del proveedor.
export async function generateCompletion(system: string, user: string): Promise<CompletionResult> {
  const token = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!token) {
    throw new Error("HUGGINGFACEHUB_API_TOKEN no está configurada.");
  }
  const model = process.env.HUGGINGFACE_CHAT_MODEL || HUGGINGFACE_CHAT_MODEL_DEFAULT;

  const res = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: HUGGINGFACE_CHAT_MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (res.status === 401) {
    throw new Error(
      "Token de Hugging Face inválido o expirado (401). Revisa HUGGINGFACEHUB_API_TOKEN en .env.local.",
    );
  }

  if (!res.ok) {
    const body = await res.text();
    if (/model_not_supported|no provider|not supported/i.test(body)) {
      throw new Error(
        `El modelo de chat "${model}" ya no está disponible en el nivel gratuito de Hugging Face (rotó). Prueba otro candidato y actualiza HUGGINGFACE_CHAT_MODEL.`,
      );
    }
    throw new Error(`Hugging Face (chat) respondió con error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  const text = choice?.message?.content;

  if (!text) {
    throw new Error(
      "Hugging Face devolvió una respuesta sin contenido (choices[0].message.content vacío o ausente) — respuesta inválida del proveedor.",
    );
  }

  return {
    text,
    model: json.model ?? model,
    stopReason: choice.finish_reason ?? "unknown",
  };
}
