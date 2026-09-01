"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useOrder } from "@/hooks/useOrders";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

export default function PedidoDetallePage() {
  const params = useParams<{ id: string }>();
  const { order, loading, error, cancel, retry } = useOrder(params.id);
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancel();
      toast.success("Pedido cancelado.");
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <LoadingState rows={4} />;
  // 404 real (buyer2 abriendo un pedido de buyer1) también cae aquí: RLS
  // filtra la fila, single() no encuentra nada y el service lanza el error
  // de Postgres — no hay forma de distinguirlo de "no existe", que es
  // exactamente el comportamiento deseado (no revelar que el pedido existe).
  if (error || !order) return <ErrorState onRetry={retry} />;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Mis pedidos", href: "/pedidos" },
          { label: `Pedido #${order.id.slice(0, 8)}` },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <OrderItemsTable items={order.items} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="font-medium">Total</span>
        <Price value={order.total} size="lg" testId="order-total" />
      </div>

      {order.status === "pendiente" ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" className="self-start" data-testid="order-cancel">
                Cancelar pedido
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cancelar este pedido?</DialogTitle>
              <DialogDescription>
                El stock no se repone automáticamente. Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Volver
              </Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "Cancelando…" : "Sí, cancelar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
