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
