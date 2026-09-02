import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Review } from "@/types/review";

type Client = SupabaseClient<Database>;

export async function listByProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAverage(
  productId: string,
  supabase: Client = createClient(),
): Promise<{ average: number | null; count: number }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId);
  if (error) throw error;
  if (data.length === 0) return { average: null, count: 0 };
  const sum = data.reduce((acc, r) => acc + r.rating, 0);
  return { average: sum / data.length, count: data.length };
}

export interface CanReviewResult {
  allowed: boolean;
  orderId: string | null;
}

type DeliveredOrderRow = {
  id: string;
  order_items: { product_id: string }[];
};

// Refleja la condición exacta de reviews_insert_verified_purchase: un
// pedido 'entregado' del comprador que contenga este producto, y que
// todavía no tenga reseña suya (unique product_id+buyer_id). Es solo
// defensa en profundidad para no mostrar un formulario que RLS igual
// rechazaría — la autoridad real es la política, no esto.
export async function canReview(
  productId: string,
  userId: string,
  supabase: Client = createClient(),
): Promise<CanReviewResult> {
  const { data: existingReview, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("buyer_id", userId)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (existingReview) return { allowed: false, orderId: null };

  const { data: deliveredOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_items(product_id)")
    .eq("buyer_id", userId)
    .eq("status", "entregado")
    .returns<DeliveredOrderRow[]>();
  if (ordersError) throw ordersError;

  const match = deliveredOrders.find((order) =>
    order.order_items.some((item) => item.product_id === productId),
  );

  return { allowed: !!match, orderId: match?.id ?? null };
}

export interface CreateReviewInput {
  productId: string;
  buyerId: string;
  orderId: string;
  rating: number;
  comment?: string;
}

export async function create(
  input: CreateReviewInput,
  supabase: Client = createClient(),
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      product_id: input.productId,
      buyer_id: input.buyerId,
      order_id: input.orderId,
      rating: input.rating,
      comment: input.comment,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Permitido por reviews_update_seller_reply (RLS) + protect_review_columns_trigger
// (Fase 7.5) — el trigger es quien de verdad restringe que este UPDATE
// solo pueda tocar seller_reply/seller_reply_at, nunca rating/comment.
export async function reply(
  reviewId: string,
  replyText: string,
  supabase: Client = createClient(),
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .update({ seller_reply: replyText, seller_reply_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
