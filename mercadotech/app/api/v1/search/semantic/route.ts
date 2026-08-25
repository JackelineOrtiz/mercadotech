import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchProducts } from "@/services/vector-search.service";
import { apiError, toErrorMessage } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";

// POST /api/v1/search/semantic — requiere sesión (decisión 1: la IA nunca
// se expone a anon, protege también la cuota gratuita de Hugging Face). El
// embedding de la consulta se genera server-side: el token no viaja al
// navegador. Usa el cliente de SESIÓN (no admin) para el RPC — la RLS de
// knowledge_embeddings y products aplica con la identidad real del que
// busca, no con privilegios elevados.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(401, "unauthorized", "Inicia sesión para usar la búsqueda inteligente.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo de la solicitud debe ser JSON válido.");
  }

  const { query } = (body as Record<string, unknown>) ?? {};
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

  try {
    const results = await searchProducts(query, {}, supabase);
    return NextResponse.json({ results });
  } catch (err) {
    const message = toErrorMessage(err);
    console.warn("[search/semantic] falló:", message);
    return apiError(500, "search_failed", message);
  }
}
