"use client";

import { useAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";
import { OrderCard } from "@/components/orders/OrderCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";

export default function PedidosPage() {
  const { user } = useAuth();
  const { orders, loading, error, retry } = useOrders(user?.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Mis pedidos</h1>
      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Todavía no tienes pedidos"
          description="Cuando compres algo, aparecerá aquí."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
