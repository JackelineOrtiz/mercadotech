"use client";

import { useEffect, useState } from "react";
import { getProductById } from "@/services/product.service";
import type { Product } from "@/types/product";

// Carga bajo demanda: solo dispara el fetch cuando productId deja de ser
// null (ej. al abrir un diálogo de previsualización) — nunca precarga
// nada al montar la página que lo usa.
export function useProductPreview(productId: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getProductById(productId)
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [productId]);

  return { product, loading, error };
}
