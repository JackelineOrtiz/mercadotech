import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Order, OrderItem, OrderWithItems } from "@/types/order";
import type { OrderStatus } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

function mapOrder(row: OrderRow): Order {
  return { ...row, status: row.status as OrderStatus, total: Number(row.total) };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return { ...row, price_snapshot: Number(row.price_snapshot) };
}

// Único camino para crear un pedido: orders/order_items no tienen política
// de INSERT (Fase 2.3) — la función SECURITY DEFINER es la única vía.
// Nunca insertar en orders directamente desde este service.
export async function checkout(
  userId: string,
  supabase: Client = createClient(),
): Promise<string> {
  const { data, error } = await supabase.rpc("create_order_from_cart", {
    p_buyer_id: userId,
  });
  if (error) throw error;
  return data;
}

export async function listMyOrders(
  userId: string,
  supabase: Client = createClient(),
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();
  if (error) throw error;
  return data.map(mapOrder);
}

export async function getOrderById(
  id: string,
  supabase: Client = createClient(),
): Promise<OrderWithItems> {
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single()
    .returns<OrderRow>();
  if (orderError) throw orderError;

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .returns<OrderItemRow[]>();
  if (itemsError) throw itemsError;

  return { ...mapOrder(orderRow), items: itemRows.map(mapOrderItem) };
}

// Vía la RPC cancel_order_and_restock (Fase 7.5) — ya no un UPDATE directo.
// Antes (decisión 11 de la spec, revertida): no reponía stock; hallazgo
// real de un usuario probando la app. La función valida buyer_id y
// status='pendiente' server-side (mismo criterio que antes vivía acá como
// .eq("status", "pendiente")), así que esas dos comprobaciones ya no hacen
// falta de este lado.
export async function cancelIfPending(
  id: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.rpc("cancel_order_and_restock", { p_order_id: id });
  if (error) throw error;
}
