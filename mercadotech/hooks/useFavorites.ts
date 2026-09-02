"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listMine, toggle } from "@/services/favorite.service";
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

  // Fase 7.5, hallazgo real: /favoritos no tenía forma de desmarcar un
  // producto salvo entrando a su ficha. Optimista con rollback (mismo
  // patrón que useAdminUsers.changeRole): todo ítem en esta lista ya es
  // favorito, así que togglear siempre significa "quitar" acá — nunca
  // "agregar", a diferencia de favorite.service.toggle en general.
  const remove = useCallback(
    async (productId: string) => {
      if (!userId) return;
      const previous = items;
      setItems((prev) => prev.filter((p) => p.id !== productId));
      try {
        await toggle(userId, productId);
      } catch (err) {
        setItems(previous);
        toast.error((err as Error).message);
      }
    },
    [userId, items],
  );

  return { items, loading, error, remove, retry: fetchFavorites };
}
