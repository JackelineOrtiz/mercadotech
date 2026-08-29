import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Question } from "@/types/question";

type Client = SupabaseClient<Database>;

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
