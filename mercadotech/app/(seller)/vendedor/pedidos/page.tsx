"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSellerOrders } from "@/hooks/useSellerOrders";
import { OrdersKanban } from "@/components/seller/OrdersKanban";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";

export default function VendedorPedidosPage() {
  const { profile } = useAuth();
  const { orders, byStatus, loading, error, move, retry } = useSellerOrders(profile?.id);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (orders.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes pedidos"
        description="Cuando alguien compre tus productos, aparecerán aquí."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <OrdersKanban ordersByStatus={byStatus} onMove={move} />
    </div>
  );
}
