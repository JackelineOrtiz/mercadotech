"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductWithSimilarity } from "@/services/vector-search.service";

// enabled evita gastar la cuota gratuita de Hugging Face buscando en cada
// tecleo o en cada carga de /buscar: solo se llama al endpoint cuando la
// pestaña "Resultados con IA" está activa Y hay sesión — lo decide la
// página, este hook solo obedece la bandera.
export function useSemanticSearch(query: string | undefined, enabled: boolean) {
  const [results, setResults] = useState<ProductWithSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(() => {
    if (!enabled || !query) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/v1/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo buscar.");
        return json as { results: ProductWithSimilarity[] };
      })
      .then((json) => {
        if (cancelled) return;
        setResults(json.results);
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
  }, [query, enabled]);

  useEffect(() => {
    const cancel = search();
    return cancel;
  }, [search]);

  return { results, loading, error, retry: search };
}
