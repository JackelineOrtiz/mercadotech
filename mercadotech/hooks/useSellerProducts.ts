"use client";

import { useCallback, useEffect, useState } from "react";
import * as sellerService from "@/services/seller.service";
import { triggerReindex } from "@/services/indexing-trigger.service";
import type { Product } from "@/types/product";

export function useSellerProducts(sellerId?: string) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    if (!sellerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    sellerService
      .listMyProducts(sellerId)
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [sellerId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // triggerReindex tras ambas acciones (Fase 4.3): el endpoint decide qué
  // hacer con la ficha — reindexarla (el producto sigue existiendo, solo
  // cambió is_active) o borrarla (deleteProduct hizo que la fuente ya no
  // exista) — el hook no necesita distinguir los dos casos.
  const toggleActive = useCallback(async (productId: string, isActive: boolean) => {
    await sellerService.toggleActive(productId, isActive);
    setItems((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, is_active: isActive } : p)),
    );
    triggerReindex("producto", productId);
  }, []);

  const remove = useCallback(async (productId: string) => {
    await sellerService.deleteProduct(productId);
    setItems((prev) => prev.filter((p) => p.id !== productId));
    triggerReindex("producto", productId);
  }, []);

  return { items, loading, error, toggleActive, remove, retry: fetchProducts };
}
