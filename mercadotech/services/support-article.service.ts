import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SupportArticle } from "@/types/support-article";

type Client = SupabaseClient<Database>;

// Agregado en la Fase 5.4 (Sesión 5): hasta ahora nada exponía los
// artículos de FAQ como service — scripts/index-all.ts los lee con una
// query inline propia (Fase 4.3), y la web nunca necesitó listarlos
// directo (el chat de soporte los recupera semánticamente vía
// knowledge_embeddings, no por listado). El resource mercadotech://faq
// (5.4) sí necesita el listado completo real — se agrega acá, reutilizable
// por toda la app, no una query embebida en mcp/.
export async function listPublished(
  supabase: Client = createClient(),
): Promise<SupportArticle[]> {
  const { data, error } = await supabase
    .from("support_articles")
    .select("*")
    .eq("is_published", true)
    .order("category")
    .order("title");
  if (error) throw error;
  return data;
}
