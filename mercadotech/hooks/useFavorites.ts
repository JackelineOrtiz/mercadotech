"use client";

import { useCallback, useEffect, useState } from "react";
import { listMine } from "@/services/favorite.service";
import type { Product } from "@/types/product";

// Lista completa para /favoritos. Requiere sesión (la ruta ya está
// protegida por el middleware); userId undefined solo puede pasar en el
// instante antes de que useAuth resuelva.
export function useFavorites(userId?: string) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listMine(userId)
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
    fetchFavorites();
  }, [fetchFavorites]);

  return { items, loading, error, retry: fetchFavorites };
}
