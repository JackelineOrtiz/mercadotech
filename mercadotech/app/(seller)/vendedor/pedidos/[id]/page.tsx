"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSellerOrder } from "@/hooks/useSellerOrders";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { Price } from "@/components/shared/Price";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

// Fase 7.5, hallazgo real: las tarjetas del kanban del vendedor nunca
// llevaban a ningún lado (ver components/seller/OrderKanbanCard). A
// diferencia de /pedidos/[id] (comprador), acá SOLO se muestran myItems/
// myTotal — nunca order.items/order.total completos — porque en un pedido
// multi-vendedor el vendedor no debe ver ítems ni montos de otro vendedor
// (order_items_select_buyer_seller_or_admin ya los filtra a nivel de RLS;
// este tipo, SellerOrder, solo documenta esa forma). Sin acciones de
// cambio de estado acá: eso sigue viviendo únicamente en el kanban
// (useSellerOrders.move), esta página es de solo lectura.
export default function VendedorPedidoDetallePage() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { order, loading, error, retry } = useSellerOrder(profile?.id, params.id);

  if (loading) return <LoadingState rows={4} />;
  if (error || !order) return <ErrorState onRetry={retry} />;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Pedidos", href: "/vendedor/pedidos" },
          { label: `Pedido #${order.id.slice(0, 8)}` },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedido #{order.id.slice(0, 8)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-muted-foreground">
        {new Date(order.created_at).toLocaleDateString("es-CO")}
      </p>

      <OrderItemsTable items={order.myItems} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="font-medium">Mi total</span>
        <Price value={order.myTotal} size="lg" testId="seller-order-total" />
      </div>
    </div>
  );
}
