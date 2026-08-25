"use client";

import { useCallback, useEffect, useState } from "react";
import * as orderService from "@/services/order.service";
import type { Order, OrderWithItems } from "@/types/order";

export function useOrders(userId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    orderService
      .listMyOrders(userId)
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, retry: fetchOrders };
}

export function useOrder(orderId: string) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(() => {
    setLoading(true);
    setError(null);
    orderService
      .getOrderById(orderId)
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const cancel = useCallback(async () => {
    await orderService.cancelIfPending(orderId);
    await fetchOrder();
  }, [orderId, fetchOrder]);

  return { order, loading, error, cancel, retry: fetchOrder };
}
