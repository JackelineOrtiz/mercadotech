"use client";

import Link from "next/link";
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
      data-testid={`kanban-card-${order.id}`}
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
        {new Date(order.created_at).toLocaleDateString("es-CO")}
      </span>
      <span className="text-xs text-muted-foreground">
        {order.myItems.length} {order.myItems.length === 1 ? "ítem mío" : "ítems míos"}
      </span>
      <Price value={order.myTotal} size="sm" />
      {/* Hallazgo real (Fase 7.5): esta tarjeta nunca tuvo forma de ver el
          detalle del pedido, en NINGUNA columna — no solo "Cancelado",
          donde un usuario lo encontró primero. onPointerDown con
          stopPropagation para que dnd-kit (los `listeners` del div padre)
          nunca capture el puntero acá — sin esto, cualquier intento de
          click en este link se interpretaría como el inicio de un drag. */}
      <Link
        href={`/vendedor/pedidos/${order.id}`}
        data-testid={`kanban-card-detail-${order.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-1 w-fit text-xs font-medium text-primary hover:underline"
      >
        Ver detalle
      </Link>
    </div>
  );
}
