"use client";

import { Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import { ErrorState } from "@/components/shared/ErrorState";

function HomePageContent() {
  const { profile } = useAuth();
  const { items, total, page, loading, error, filters, setFilter, setPage, retry } = useProducts({
    excludeSellerId: profile?.id,
  });

  function handleFiltersChange(patch: Partial<FiltersValue>) {
    if (patch.condition !== undefined) setFilter("condition", patch.condition);
    if ("minPrice" in patch) {
      setFilter("min", patch.minPrice !== undefined ? String(patch.minPrice) : undefined);
    }
    if ("maxPrice" in patch) {
      setFilter("max", patch.maxPrice !== undefined ? String(patch.maxPrice) : undefined);
    }
    if (patch.sort !== undefined) setFilter("sort", patch.sort);
    if (patch.hideOutOfStock !== undefined) {
      setFilter("sinStock", patch.hideOutOfStock ? "0" : undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <FiltersPanel value={filters} onChange={handleFiltersChange} />
      <div className="min-w-0 flex-1">
        <h1 className="mb-4 text-2xl font-bold">Catálogo</h1>
        {error ? (
          <ErrorState onRetry={retry} />
        ) : (
          <>
            {/* Fase 7.2 (performance): se probó priorityCount={4} acá (la
                spec pide priority SOLO en la portada above-the-fold de la
                home) y se REVIRTIÓ — medido en docs/PERFORMANCE.md: el
                elemento LCP real de esta página es el título (texto) de
                la primera tarjeta, no su imagen, así que precargar 4
                imágenes con priority no ayuda al LCP y compite por ancho
                de banda con el JS de hidratación que sí lo determina
                (84 → 82 medido, reproducido 2 veces). El prop `priority`
                queda disponible en ProductImage/ProductCard/ProductGrid
                para si en el futuro la portada cambia a tener una imagen
                real above-the-fold. */}
            <ProductGrid items={items} loading={loading} />
            <Pagination page={page} total={total} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  );
}
