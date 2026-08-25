"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { OrderKanbanCard } from "@/components/seller/OrderKanbanCard";
import { ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/constants/roles";
import type { SellerOrder } from "@/types/order";

const COLUMNS: OrderStatus[] = ["pendiente", "pagado", "enviado", "entregado", "cancelado"];

export interface OrdersKanbanProps {
  ordersByStatus: Record<OrderStatus, SellerOrder[]>;
  onMove: (orderId: string, toStatus: OrderStatus) => void;
}

function Column({ status, orders }: { status: OrderStatus; orders: SellerOrder[] }) {
  // "Cancelado" es de solo lectura (decisión 9): no acepta drops y sus
  // tarjetas no son arrastrables — el vendedor no puede cancelar (RLS no
  // se lo prohíbe, pero la spec sí, y aquí es la única barrera real).
  const acceptsDrops = status !== "cancelado";
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !acceptsDrops });

  return (
    <div className="flex w-64 shrink-0 flex-col gap-2">
      <h2 className="flex items-center justify-between text-sm font-semibold">
        {ORDER_STATUS_LABELS[status]}
        <span className="text-xs font-normal text-muted-foreground">{orders.length}</span>
      </h2>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 flex-col gap-2 rounded-lg border border-dashed border-border p-2",
          acceptsDrops && isOver && "border-primary bg-primary/5",
          !acceptsDrops && "border-solid bg-muted/30",
        )}
      >
        {orders.map((order) => (
          <OrderKanbanCard key={order.id} order={order} draggable={acceptsDrops} />
        ))}
      </div>
    </div>
  );
}

export function OrdersKanban({ ordersByStatus, onMove }: OrdersKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const toStatus = over.id as OrderStatus;
    const fromStatus = active.data.current?.status as OrderStatus | undefined;
    if (!fromStatus || fromStatus === toStatus) return;
    onMove(String(active.id), toStatus);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((status) => (
          <Column key={status} status={status} orders={ordersByStatus[status]} />
        ))}
      </div>
    </DndContext>
  );
}
