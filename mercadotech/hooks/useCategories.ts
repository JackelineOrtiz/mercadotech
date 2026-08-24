"use client";

import { useEffect, useState } from "react";
import { listCategories } from "@/services/category.service";
import type { Category } from "@/types/product";

// Cache simple en memoria a nivel de módulo: las categorías cambian poco
// (solo un admin las edita) y el Navbar + cada página de catálogo montan
// este hook por separado — sin esto, cada uno dispararía su propio fetch.
let cache: Category[] | null = null;

export function useCategories() {
  // El estado inicial NUNCA puede depender de `cache`: en el servidor este
  // módulo siempre arranca en null (los efectos no corren en SSR), pero en
  // el cliente, si ya se navegó antes en la misma pestaña, `cache` puede
  // venir poblado — usarlo como initial state produce un mismatch de
  // hidratación (servidor renderiza "sin categorías", cliente ya las tiene).
  // El primer render SIEMPRE arranca igual en ambos lados; el cache solo se
  // aplica dentro del efecto, que corre después de montar.
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) {
      setCategories(cache);
      setLoading(false);
      return;
    }

    let cancelled = false;

    listCategories()
      .then((data) => {
        if (cancelled) return;
        cache = data;
        setCategories(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError((err as Error).message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading, error };
}
