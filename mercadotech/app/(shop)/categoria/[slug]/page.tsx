"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import { ErrorState } from "@/components/shared/ErrorState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

function CategoriaPageContent() {
  const params = useParams<{ slug: string }>();
  const { categories } = useCategories();
  const category = categories.find((c) => c.slug === params.slug);

  const { items, total, page, loading, error, filters, setFilter, setPage, retry } = useProducts({
    categorySlug: params.slug,
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
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Hallazgo real (Fase 7.5): sin esto, la única forma de salir de una
          categoría y ver el catálogo completo era el logo — ni el menú
          "Categorías" ni esta página ofrecían un "quitar filtro" (ver
          también CategoriesMenu, que ahora suma "Todas las categorías"). */}
      <Breadcrumbs
        items={[{ label: "Catálogo", href: "/" }, { label: category?.name ?? "Categoría" }]}
      />
      <div className="flex flex-col gap-6 md:flex-row">
        <FiltersPanel value={filters} onChange={handleFiltersChange} />
        <div className="min-w-0 flex-1">
          <h1 className="mb-4 text-2xl font-bold">{category?.name ?? "Categoría"}</h1>
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
    </div>
  );
}

export default function CategoriaPage() {
  return (
    <Suspense fallback={null}>
      <CategoriaPageContent />
    </Suspense>
  );
}
