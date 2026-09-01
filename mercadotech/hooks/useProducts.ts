"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { listActiveProducts } from "@/services/product.service";
import type { Product } from "@/types/product";
import type { ProductCondition } from "@/lib/constants/roles";
import { DEFAULT_SORT, type SortOption } from "@/lib/constants/catalog";

export interface UseProductsFilters {
  search?: string;
  condition: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
}

export interface UseProductsOptions {
  // Fijo desde el segmento de ruta en /categoria/[slug] — no viene de la URL
  // de búsqueda como los demás filtros.
  categorySlug?: string;
  // Mismo patrón que categorySlug, fijo desde /tienda/[sellerId] (fuera del
  // PDF de la spec — storefront público del vendedor).
  sellerId?: string;
}

export function useProducts({ categorySlug, sellerId }: UseProductsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const search = searchParams.get("q") ?? undefined;
  const conditionParams = searchParams.getAll("condition") as ProductCondition[];
  const conditionKey = conditionParams.join(",");
  const minPriceParam = searchParams.get("min");
  const maxPriceParam = searchParams.get("max");
  const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;
  const sort = (searchParams.get("sort") as SortOption | null) ?? DEFAULT_SORT;
  const pageParam = searchParams.get("page");
  const page = pageParam ? Number(pageParam) : 1;

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    listActiveProducts({
      categorySlug,
      sellerId,
      search,
      condition: conditionKey ? (conditionKey.split(",") as ProductCondition[]) : undefined,
      minPrice,
      maxPrice,
      sort,
      page,
    })
      .then(({ items, total }) => {
        setItems(items);
        setTotal(total);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [categorySlug, sellerId, search, conditionKey, minPrice, maxPrice, sort, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Escribe el filtro en la URL (estado compartible/recargable) y vuelve a
  // página 1 — un filtro nuevo invalida la paginación anterior.
  const setFilter = useCallback(
    (key: string, value: string | string[] | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else if (value !== undefined && value !== "") {
        params.set(key, value);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const setPage = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const filters: UseProductsFilters = {
    search,
    condition: conditionParams,
    minPrice,
    maxPrice,
    sort,
  };

  return { items, total, page, loading, error, filters, setFilter, setPage, retry: fetchProducts };
}
