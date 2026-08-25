// scripts/index-all.ts — indexa TODOS los productos activos y artículos de
// soporte publicados de una sola vez. Se corre fuera del navegador, con el
// cliente admin (bypasea RLS a propósito: necesita leer/escribir sin
// depender de una sesión de usuario). Dos usos:
//   1. Puesta al día inicial de knowledge_embeddings (o tras un
//      `supabase db reset`, que la deja vacía).
//   2. Vía de reindexación para cambios que el trigger automático (Fase
//      4.3, publicar/editar por la UI) no cubre — ej. un admin que edita
//      un artículo de soporte directo por SQL en vez de por la app.
//
// Uso: npx tsx scripts/index-all.ts (desde mercadotech/).
process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import { indexProduct, indexSupportArticle } from "@/services/embedding.service";
import type { Database } from "@/types/database";

// No se reutiliza lib/supabase/admin.ts: ese archivo importa "server-only",
// un paquete que solo funciona como no-op DENTRO del bundler de Next.js
// (webpack/turbopack lo intercambia por una versión vacía según el target
// de build) — corrido con tsx fuera de Next, su import throw incondicional
// ("This module cannot be imported from a Client Component module").
// scripts/ vive fuera de ese bundler a propósito, así que el cliente admin
// se construye aquí con el mismo par de credenciales, sin el guard.
// Node 20 (el de este proyecto, ver el warning de deprecación de
// supabase-js) no expone WebSocket global — llega recién en Node 22 — y
// @supabase/supabase-js instancia su RealtimeClient interno de forma
// EAGER en el constructor, incluso si nunca se usa .channel(): sin esto,
// createClient() lanza "Node.js detected but native WebSocket not found"
// apenas se llama, no al conectar (confirmado corriendo este script antes
// de este fix). Este cliente nunca suscribe canales — el stub solo evita
// la resolución eager del transporte, no se usa de verdad.
class NoopWebSocketTransport {}

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: NoopWebSocketTransport as unknown as typeof WebSocket },
    },
  );
}

async function main() {
  const supabase = createAdminClient();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, title")
    .eq("is_active", true);
  if (productsError) throw productsError;

  const { data: articles, error: articlesError } = await supabase
    .from("support_articles")
    .select("id, title")
    .eq("is_published", true);
  if (articlesError) throw articlesError;

  console.log(`Indexando ${products.length} productos activos...`);
  for (const product of products) {
    await indexProduct(product.id, supabase);
    console.log(`  ✓ producto: ${product.title}`);
  }

  console.log(`\nIndexando ${articles.length} artículos publicados...`);
  for (const article of articles) {
    await indexSupportArticle(article.id, supabase);
    console.log(`  ✓ artículo: ${article.title}`);
  }

  const total = products.length + articles.length;
  console.log(
    `\nListo: ${products.length} productos + ${articles.length} artículos = ${total} fichas en knowledge_embeddings.`,
  );
}

main().catch((err) => {
  console.error("\nERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
