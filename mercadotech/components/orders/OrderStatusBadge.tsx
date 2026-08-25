import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_VARIANT } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";

export interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
