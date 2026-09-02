import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ask } from "@/services/chat.service";
import { apiError, toErrorMessage } from "@/lib/api-response";
import { CHAT_HISTORY_MAX_TURNS, CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import type { ChatHistoryTurn, ChatMode } from "@/types/chat";

const VALID_MODES = ["compras", "soporte"] as const;
const VALID_HISTORY_ROLES = ["user", "assistant"] as const;

function isChatMode(value: unknown): value is ChatMode {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value);
}

// Fase 7.5, hallazgo real: el endpoint no aceptaba NINGÚN historial — cada
// mensaje era una consulta independiente para el modelo, aunque la UI
// mostrara una conversación continua. Nunca se confía en lo que manda el
// cliente: se valida la forma de cada turno y se recorta a los últimos
// CHAT_HISTORY_MAX_TURNS acá, no en chat.service — es al Route Handler
// (el único borde real con el navegador) a quien le toca sanear input
// externo, mismo criterio que ya aplica a query/mode.
function parseHistory(value: unknown): ChatHistoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatHistoryTurn[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const role = (item as Record<string, unknown>).role;
    const content = (item as Record<string, unknown>).content;
    if (
      typeof role === "string" &&
      (VALID_HISTORY_ROLES as readonly string[]).includes(role) &&
      typeof content === "string" &&
      content.trim().length > 0 &&
      content.length <= CHAT_QUERY_MAX_CHARS
    ) {
      turns.push({ role: role as ChatHistoryTurn["role"], content });
    }
  }
  return turns.slice(-CHAT_HISTORY_MAX_TURNS);
}

// POST /api/v1/chat — requiere sesión (decisión 1). Usa el cliente de
// SESIÓN (no admin) para que la búsqueda respete RLS. mode inválido es
// 422 (unprocessable), no 400: el body ES JSON válido con la forma
// correcta, el VALOR de mode es lo que no se reconoce.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(401, "unauthorized", "Necesitas iniciar sesión para usar el chat.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo de la solicitud debe ser JSON válido.");
  }

  const { query, mode, history } = (body as Record<string, unknown>) ?? {};
  if (typeof query !== "string" || query.trim().length === 0) {
    return apiError(400, "invalid_body", "query es requerido y no puede estar vacío.");
  }
  if (query.length > CHAT_QUERY_MAX_CHARS) {
    return apiError(
      400,
      "invalid_body",
      `query no puede superar ${CHAT_QUERY_MAX_CHARS} caracteres.`,
    );
  }
  if (!isChatMode(mode)) {
    return apiError(422, "invalid_mode", `mode debe ser uno de ${VALID_MODES.join("/")}.`);
  }
  const chatHistory = parseHistory(history);

  try {
    const result = await ask(query, mode, {}, supabase, chatHistory);
    // Log estructurado: insumo de la calibración de la Fase 4.8 (decidir
    // si el threshold 0.3 se queda o se mueve, con datos reales de uso).
    console.log(
      `[chat] mode=${mode} retrievedCount=${result.metadata.retrievedCount} usedSourceCount=${result.metadata.usedSourceCount} hasRelevantContext=${result.hasRelevantContext} contextTruncated=${result.metadata.contextTruncated}`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = toErrorMessage(err);
    console.warn(`[chat] mode=${mode} falló:`, message);
    return apiError(500, "chat_failed", message);
  }
}
