import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MyQuestion, Question } from "@/types/question";
import { getPublicUrl } from "@/services/storage.service";

type Client = SupabaseClient<Database>;

type MyQuestionRow = Question & {
  products: {
    title: string;
    product_images: { image_path: string; position: number }[];
  } | null;
};

// Fase 7.5, hallazgo real: no existía ningún lugar para que un comprador
// revisara DESPUÉS una pregunta que ya había hecho — había que recordar en
// qué producto se preguntó y volver a esa ficha para ver si ya tenía
// respuesta. questions_select_all es pública (using (true)), así que
// filtrar por user_id acá no depende de ningún permiso especial — join
// anidado a products (no dos queries, a diferencia de
// seller.service.listMyQuestions: acá no hace falta la lista de "mis
// productos" como paso intermedio, un solo product_id por pregunta ya
// alcanza para el join). image_url resuelta acá mismo (misma convención
// que product.service.ts: la UI nunca recibe un image_path crudo), pasando
// el cliente inyectado a getPublicUrl (no el bug ya documentado en
// cart.service.ts de nunca propagarlo).
export async function listByUser(
  userId: string,
  supabase: Client = createClient(),
): Promise<MyQuestion[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*, products(title, product_images(image_path, position))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<MyQuestionRow[]>();
  if (error) throw error;

  return data.map(({ products, ...question }) => {
    const cover = products
      ? [...products.product_images].sort((a, b) => a.position - b.position)[0]
      : undefined;
    return {
      ...question,
      productTitle: products?.title ?? "",
      productImageUrl: cover ? getPublicUrl("product-images", cover.image_path, supabase) : null,
    };
  });
}

export async function listByProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Agregada en la Fase 5.4 (Sesión 5): el prompt MCP
// redactar_respuesta_pregunta necesita una pregunta puntual, no la lista
// completa de un producto — ninguna función existente lo resolvía.
export async function getById(
  questionId: string,
  supabase: Client = createClient(),
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .single();
  if (error) throw error;
  return data;
}

// Permitido por questions_insert_own: with check ((select auth.uid()) = user_id).
export async function create(
  productId: string,
  userId: string,
  question: string,
  supabase: Client = createClient(),
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .insert({ product_id: productId, user_id: userId, question })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Permitido por questions_update_answer_by_seller (dueño del producto) +
// el GRANT de columna que solo expone answer/answered_at — un intento de
// tocar "question" con este mismo service fallaría con permission denied,
// tal como debe ser.
export async function answer(
  questionId: string,
  answerText: string,
  supabase: Client = createClient(),
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update({ answer: answerText, answered_at: new Date().toISOString() })
    .eq("id", questionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
