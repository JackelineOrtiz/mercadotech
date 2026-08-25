import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  indexSource,
  isSourceNotFoundError,
  removeEmbeddings,
} from "@/services/embedding.service";
import { apiError } from "@/lib/api-response";

const SOURCE_TYPES = ["producto", "articulo_soporte"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
}

// Los errores de Postgrest (ej. product_error de embedding.service) son
// objetos planos {message, details, hint, code}, NO instancias de Error —
// String(err) sobre ellos da el inútil "[object Object]". Se extrae
// .message explícitamente antes de caer a String().
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

// POST /api/v1/reindex — server-only: es el único lugar (junto con
// scripts/index-all.ts) que instancia el cliente admin para escribir en
// knowledge_embeddings. El navegador nunca lo toca directamente; llega
// aquí vía services/indexing-trigger.service.ts (fetch fire-and-forget).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiError(401, "unauthorized", "Necesitas iniciar sesión para reindexar.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "El cuerpo de la solicitud debe ser JSON válido.");
  }

  const { sourceType, sourceId } = (body as Record<string, unknown>) ?? {};
  if (!isSourceType(sourceType) || typeof sourceId !== "string" || sourceId.length === 0) {
    return apiError(
      400,
      "invalid_body",
      `sourceType debe ser uno de ${SOURCE_TYPES.join("/")} y sourceId un string no vacío.`,
    );
  }

  const admin = createAdminClient();

  try {
    await indexSource(sourceType, sourceId, admin);
    return NextResponse.json({ ok: true, action: "indexed" });
  } catch (err) {
    // La fuente ya no existe (ej. producto borrado): en vez de fallar, se
    // limpia la ficha huérfana (decisión 6 de la spec) — no es un error
    // real del endpoint, es el caso esperado tras un delete.
    if (isSourceNotFoundError(err)) {
      await removeEmbeddings(sourceType, sourceId, admin);
      return NextResponse.json({ ok: true, action: "removed" });
    }
    const message = toErrorMessage(err);
    // Best-effort: se registra en la consola del SERVIDOR (terminal de
    // `npm run dev`), no se propaga como una falla visible al vendedor —
    // publicar/editar ya tuvo éxito antes de llegar aquí (Fase 4.3, "el
    // trigger es invisible para el vendedor").
    console.warn(`[reindex] ${sourceType}/${sourceId} falló:`, message);
    return apiError(500, "indexing_failed", message);
  }
}
