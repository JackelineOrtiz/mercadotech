"use client";

import { useCallback, useEffect, useState } from "react";
import * as favoriteService from "@/services/favorite.service";

// Estado del favorito de UN producto (para el botón del BuyBox). La lista
// completa para /favoritos vive en useFavorites.ts.
export function useFavorite(productId: string, userId?: string) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setIsFavorite(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    favoriteService
      .isFavorite(userId, productId)
      .then((value) => {
        if (cancelled) return;
        setIsFavorite(value);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, userId]);

  const toggle = useCallback(async () => {
    if (!userId) return;
    const next = !isFavorite;
    setIsFavorite(next); // optimista
    try {
      const result = await favoriteService.toggle(userId, productId);
      setIsFavorite(result);
    } catch {
      setIsFavorite(!next); // revierte
    }
  }, [userId, productId, isFavorite]);

  return { isFavorite, loading, toggle };
}
