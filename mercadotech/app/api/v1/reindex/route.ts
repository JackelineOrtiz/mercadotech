import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  indexSource,
  isSourceNotFoundError,
  removeEmbeddings,
} from "@/services/embedding.service";
import { apiError, toErrorMessage } from "@/lib/api-response";

const SOURCE_TYPES = ["producto", "articulo_soporte"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

function isSourceType(value: unknown): value is SourceType {
  return typeof value === "string" && (SOURCE_TYPES as readonly string[]).includes(value);
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

  // Hallazgo del lab de gobernanza (Fase 5.6): el endpoint exigía sesión
  // pero no verificaba que el caller fuera dueño de sourceId — cualquier
  // usuario autenticado podía forzar el reindexado de un producto o
  // artículo ajeno, gastando la cuota compartida de Hugging Face sin
  // control. Se usa el cliente ADMIN para esta comprobación (no el de
  // sesión): RLS ocultaría un producto inactivo ajeno con un select
  // normal, y eso haría pasar la comprobación como "no existe" en vez de
  // "existe y no es tuyo" — el admin ve el estado real siempre.
  // Si el producto YA NO EXISTE (delete legítimo seguido de su propio
  // triggerReindex, Fase 4.3), se deja pasar: indexSource lanzará su
  // propio "not found" más abajo, que ya limpia la ficha huérfana — no se
  // rompe ese flujo existente.
  if (sourceType === "producto") {
    const { data: product } = await admin
      .from("products")
      .select("seller_id")
      .eq("id", sourceId)
      .maybeSingle();
    if (product && product.seller_id !== user.id) {
      return apiError(403, "forbidden", "Solo puedes reindexar tus propios productos.");
    }
  } else {
    // articulo_soporte: ningún flujo de la UI dispara esta rama hoy
    // (solo producto, desde useProductForm/useSellerProducts) — solo un
    // admin gestiona artículos (support_articles_insert_admin/update_admin,
    // Fase 2.3), así que solo un admin puede reindexarlos.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return apiError(403, "forbidden", "Solo un admin puede reindexar artículos de soporte.");
    }
  }

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
