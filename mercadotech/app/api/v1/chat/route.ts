import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ask } from "@/services/chat.service";
import { apiError, toErrorMessage } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import type { ChatMode } from "@/types/chat";

const VALID_MODES = ["compras", "soporte"] as const;

function isChatMode(value: unknown): value is ChatMode {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value);
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

  const { query, mode } = (body as Record<string, unknown>) ?? {};
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

  try {
    const result = await ask(query, mode, {}, supabase);
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
