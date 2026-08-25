import type { Database } from "@/types/database";
import type { OrderStatus } from "@/lib/constants/roles";

export type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  status: OrderStatus;
  total: number;
};

// order_items es un snapshot histórico inmutable (título/precio al momento
// de la compra) — price_snapshot llega como string, igual que products.price.
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"] & {
  price_snapshot: number;
};

export type OrderWithItems = Order & {
  items: OrderItem[];
};

// Vista del vendedor sobre un pedido multi-vendedor (seed: c…01, con ítems
// de seller1 Y seller2): myItems/myTotal son SOLO sus ítems, nunca
// order.total — order_items_select_buyer_seller_or_admin ya filtra las
// filas a nivel de RLS, este tipo solo documenta la forma resultante.
export type SellerOrder = Order & {
  myItems: OrderItem[];
  myTotal: number;
};
