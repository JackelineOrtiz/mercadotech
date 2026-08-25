import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";
import type { SellerOrder } from "@/types/order";
import type { OrderStatus, ProductCondition } from "@/lib/constants/roles";
import { PRODUCT_SELECT, mapProduct, type ProductQueryRow } from "@/services/product.service";

type Client = SupabaseClient<Database>;

// A diferencia de listActiveProducts (3.4), sin .eq("is_active", true):
// products_select_active_or_own ya deja pasar los inactivos del dueño, y
// el vendedor necesita verlos para poder reactivarlos.
export async function listMyProducts(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .returns<ProductQueryRow[]>();
  if (error) throw error;
  return data.map((row) => mapProduct(row, supabase));
}

export interface ProductInput {
  categoryId: string;
  title: string;
  description: string;
  brand: string;
  condition: ProductCondition;
  price: number;
  stock: number;
}

export async function createProduct(
  sellerId: string,
  input: ProductInput,
  supabase: Client = createClient(),
): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .insert({
      seller_id: sellerId,
      category_id: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      brand: input.brand.trim() || null,
      condition: input.condition,
      price: input.price,
      stock: input.stock,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      category_id: input.categoryId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      brand: input.brand.trim() || null,
      condition: input.condition,
      price: input.price,
      stock: input.stock,
    })
    .eq("id", productId);
  if (error) throw error;
}

export async function toggleActive(
  productId: string,
  isActive: boolean,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId);
  if (error) throw error;
}

// order_items.product_id es "on delete restrict" (Fase 2.2): un producto
// con historial de ventas no puede borrarse físicamente. Postgres devuelve
// el código 23503 (foreign_key_violation) — se traduce a un mensaje
// legible en vez de dejar pasar el error crudo de Postgres (decisión 10).
export async function deleteProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Este producto tiene ventas; desactívalo en lugar de eliminarlo.");
    }
    throw error;
  }
}

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];

// Dos queries en vez de un join anidado: order_items_select_buyer_seller_or_admin
// ya filtra la primera a "mis ítems", así que orderIds sale de ahí; el
// segundo query trae los pedidos completos (para status/created_at), pero
// myItems/myTotal siempre se calculan solo con las filas del primer query
// — nunca con todos los ítems del pedido (decisión de la spec: un pedido
// multi-vendedor, seed c…01, reparte ítems entre seller1 y seller2).
export async function listMyOrders(
  sellerId: string,
  supabase: Client = createClient(),
): Promise<SellerOrder[]> {
  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("seller_id", sellerId)
    .returns<OrderItemRow[]>();
  if (itemsError) throw itemsError;

  if (itemRows.length === 0) return [];

  const orderIds = [...new Set(itemRows.map((row) => row.order_id))];

  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .in("id", orderIds)
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();
  if (ordersError) throw ordersError;

  return orderRows.map((row) => {
    const myItems = itemRows
      .filter((item) => item.order_id === row.id)
      .map((item) => ({ ...item, price_snapshot: Number(item.price_snapshot) }));
    const myTotal = myItems.reduce(
      (sum, item) => sum + item.price_snapshot * item.quantity,
      0,
    );
    return {
      ...row,
      status: row.status as OrderStatus,
      total: Number(row.total),
      myItems,
      myTotal,
    };
  });
}

// orders_update_seller_advance_or_buyer_cancel permite al vendedor poner
// CUALQUIER estado en un pedido con ítems suyos — el WITH CHECK de esa
// política solo repite is_order_seller(orders.id), sin restringir el
// destino. La regla de negocio real ("un paso adelante", "nunca
// cancelado") vive en useSellerOrders y se aplica ANTES de llamar a este
// service: este service confía en su llamador, como el resto de la capa.
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}
