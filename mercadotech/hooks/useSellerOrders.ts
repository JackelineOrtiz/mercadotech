"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as sellerService from "@/services/seller.service";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import type { SellerOrder } from "@/types/order";

// Transiciones válidas (un paso adelante en ORDER_STATUS_FLOW):
//   pendiente → pagado, pagado → enviado, enviado → entregado — y nada más.
// Inválidas y por qué:
//   - pendiente → entregado (salta pasos): rechazada aquí, RLS la habría
//     dejado pasar igual (no valida secuencia).
//   - entregado → pagado (retrocede): mismo motivo, rechazada aquí.
//   - cualquier estado → cancelado: 'cancelado' no está en
//     ORDER_STATUS_FLOW, así que indexOf(to) siempre da -1 y nunca es
//     "fromIndex + 1" — rechazada aquí. A nivel de RLS, el vendedor SÍ
//     podría poner 'cancelado' (el WITH CHECK de
//     orders_update_seller_advance_or_buyer_cancel no restringe el destino
//     para su rama), así que esta es la única de las tres donde el hook es
//     la única barrera real, no una capa redundante sobre RLS.
function canMove(from: OrderStatus, to: OrderStatus): boolean {
  const fromIndex = ORDER_STATUS_FLOW.indexOf(from);
  const toIndex = ORDER_STATUS_FLOW.indexOf(to);
  return fromIndex !== -1 && toIndex === fromIndex + 1;
}

export function useSellerOrders(sellerId?: string) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    if (!sellerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    sellerService
      .listMyOrders(sellerId)
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [sellerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const byStatus = useMemo(() => {
    const groups: Record<OrderStatus, SellerOrder[]> = {
      pendiente: [],
      pagado: [],
      enviado: [],
      entregado: [],
      cancelado: [],
    };
    for (const order of orders) groups[order.status].push(order);
    return groups;
  }, [orders]);

  // Optimista con rollback: mueve la tarjeta en el estado local antes de
  // llamar al service; si falla (red, o RLS si alguna vez cambia), revierte
  // y avisa con toast — el drop no rechazado por canMove nunca debería
  // fallar en la práctica (RLS es más permisivo que el hook aquí), pero el
  // rollback cubre el caso igual.
  const move = useCallback(
    async (orderId: string, toStatus: OrderStatus) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (!canMove(order.status, toStatus)) {
        toast.error(
          `No puedes mover un pedido de "${ORDER_STATUS_LABELS[order.status]}" directo a "${ORDER_STATUS_LABELS[toStatus]}".`,
        );
        return;
      }

      const previousStatus = order.status;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o)),
      );

      try {
        await sellerService.updateOrderStatus(orderId, toStatus);
      } catch (err) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: previousStatus } : o)),
        );
        toast.error((err as Error).message);
      }
    },
    [orders],
  );

  return { orders, byStatus, loading, error, move, retry: fetchOrders };
}
