"use client";

import { useCallback, useEffect, useState } from "react";
import { getProductById, getProductImages, registerView } from "@/services/product.service";
import type { Product, ProductImage } from "@/types/product";

export function useProduct(productId: string, userId?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([productData, imagesData]) => {
        setProduct(productData);
        setImages(imagesData);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
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

  return { product, images, loading, error, retry: fetchProduct };
}
