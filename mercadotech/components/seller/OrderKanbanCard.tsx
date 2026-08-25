"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Price } from "@/components/shared/Price";
import { cn } from "@/lib/utils";
import type { SellerOrder } from "@/types/order";

export interface OrderKanbanCardProps {
  order: SellerOrder;
  draggable: boolean;
}

export function OrderKanbanCard({ order, draggable }: OrderKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { status: order.status },
    disabled: !draggable,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm shadow-sm",
        draggable ? "touch-none cursor-grab" : "cursor-default opacity-80",
        isDragging && "opacity-50",
      )}
    >
      <span className="font-medium">Pedido #{order.id.slice(0, 8)}</span>
      <span className="text-xs text-muted-foreground">
        {new Date(order.created_at).toLocaleDateString("es-PE")}
      </span>
      <span className="text-xs text-muted-foreground">
        {order.myItems.length} {order.myItems.length === 1 ? "ítem mío" : "ítems míos"}
      </span>
      <Price value={order.myTotal} size="sm" />
    </div>
  );
}
