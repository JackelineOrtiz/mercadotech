"use client";

import { Suspense } from "react";
import { useProducts } from "@/hooks/useProducts";
import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import { ErrorState } from "@/components/shared/ErrorState";

function HomePageContent() {
  const { items, total, page, loading, error, filters, setFilter, setPage, retry } =
    useProducts();

  function handleFiltersChange(patch: Partial<FiltersValue>) {
    if (patch.condition !== undefined) setFilter("condition", patch.condition);
    if ("minPrice" in patch) {
      setFilter("min", patch.minPrice !== undefined ? String(patch.minPrice) : undefined);
    }
    if ("maxPrice" in patch) {
      setFilter("max", patch.maxPrice !== undefined ? String(patch.maxPrice) : undefined);
    }
    if (patch.sort !== undefined) setFilter("sort", patch.sort);
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
