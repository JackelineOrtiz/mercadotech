"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as cartService from "@/services/cart.service";
import * as orderService from "@/services/order.service";
import type { CartItem } from "@/types/cart";

export function useCart(userId?: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    cartService
      .getItems(userId)
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const add = useCallback(
    async (productId: string, quantity: number) => {
      if (!userId) return;
      await cartService.addItem(userId, productId, quantity);
      await fetchItems();
    },
    [userId, fetchItems],
  );

  const update = useCallback(
    async (cartItemId: string, quantity: number) => {
      await cartService.updateQuantity(cartItemId, quantity);
      await fetchItems();
    },
    [fetchItems],
  );

  const remove = useCallback(
    async (cartItemId: string) => {
      await cartService.removeItem(cartItemId);
      await fetchItems();
    },
    [fetchItems],
  );

  // Éxito: el RPC ya vació el carrito, fetchItems solo refresca el estado
  // local. Error: el stock pudo cambiar (por eso falló, o por una compra
  // concurrente) — se recarga igual para que la UI muestre los datos reales,
  // no lo que el comprador tenía antes de intentar.
  const checkout = useCallback(async () => {
    if (!userId) throw new Error("Debes iniciar sesión.");
    try {
      const orderId = await orderService.checkout(userId);
      await fetchItems();
      return orderId;
    } catch (err) {
      await fetchItems();
      throw err;
    }
  }, [userId, fetchItems]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.product ? item.product.price * item.quantity : 0),
        0,
      ),
    [items],
  );

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  return {
    items,
    subtotal,
    count,
    loading,
    error,
    add,
    update,
    remove,
    checkout,
    retry: fetchItems,
  };
}
