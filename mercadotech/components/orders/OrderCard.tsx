import Link from "next/link";
import { Price } from "@/components/shared/Price";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import type { Order } from "@/types/order";

export interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <Link
      href={`/pedidos/${order.id}`}
      data-testid="order-card"
      className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 hover:bg-muted/50"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Pedido #{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>
      <OrderStatusBadge status={order.status} />
      <Price value={order.total} size="md" />
    </Link>
  );
}
