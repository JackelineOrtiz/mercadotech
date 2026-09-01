"use client";

import { useCallback, useEffect, useState } from "react";
import { getProductById, getProductImages, registerView } from "@/services/product.service";
import type { Product, ProductImage } from "@/types/product";

export function useProduct(productId: string, userId?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hallazgo real de la re-auditoría ad-hoc (ver docs/BITACORA.md): un id
  // con formato válido pero inexistente (o de un producto ya eliminado)
  // mostraba el ErrorState genérico "Algo salió mal / Reintentar" —
  // reintentar no ayuda si el producto no existe. PGRST116 es el código
  // real que PostgREST devuelve cuando .single() no encuentra filas
  // (verificado en vivo contra el REST API real) — se distingue acá para
  // que la página pueda mostrar un EmptyState "no encontrado" en vez del
  // error genérico, mismo patrón que ya usa /tienda/[sellerId].
  const [notFound, setNotFound] = useState(false);

  const fetchProduct = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([productData, imagesData]) => {
        setProduct(productData);
        setImages(imagesData);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as { code?: string }).code === "PGRST116") {
          setNotFound(true);
        } else {
          setError((err as Error).message);
        }
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // product_views_insert_own exige authenticated + user_id = auth.uid():
  // solo se dispara con sesión. Fire-and-forget — un catch silencioso, la
  // pantalla de producto no debe romperse porque falló un evento de
  // analítica.
  useEffect(() => {
    if (!userId) return;
    registerView(productId, userId).catch(() => {});
  }, [productId, userId]);

  return { product, images, loading, error, notFound, retry: fetchProduct };
}
