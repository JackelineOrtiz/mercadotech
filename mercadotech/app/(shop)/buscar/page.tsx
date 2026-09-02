"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SearchTab = "exacta" | "ia";

function BuscarPageContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? undefined;
  const { user } = useAuth();
  const [tab, setTab] = useState<SearchTab>("exacta");

  const exact = useProducts();
  // Solo se llama al endpoint (y se gasta cuota de Hugging Face) cuando la
  // pestaña IA está realmente activa Y hay sesión — decisión 1 de la spec.
  const semantic = useSemanticSearch(query, tab === "ia" && !!user);

  function handleFiltersChange(patch: Partial<FiltersValue>) {
    if (patch.condition !== undefined) exact.setFilter("condition", patch.condition);
    if ("minPrice" in patch) {
      exact.setFilter("min", patch.minPrice !== undefined ? String(patch.minPrice) : undefined);
    }
    if ("maxPrice" in patch) {
      exact.setFilter("max", patch.maxPrice !== undefined ? String(patch.maxPrice) : undefined);
    }
    if (patch.sort !== undefined) exact.setFilter("sort", patch.sort);
    if (patch.hideOutOfStock !== undefined) {
      exact.setFilter("sinStock", patch.hideOutOfStock ? "0" : undefined);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">
        {query ? `Resultados para «${query}»` : "Buscar"}
      </h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as SearchTab)}>
        <TabsList>
          <TabsTrigger value="exacta">Coincidencia exacta</TabsTrigger>
          <TabsTrigger value="ia">Resultados con IA</TabsTrigger>
        </TabsList>

        <TabsContent value="exacta" className="pt-4">
          <div className="flex flex-col gap-6 md:flex-row">
            <FiltersPanel value={exact.filters} onChange={handleFiltersChange} />
            <div className="min-w-0 flex-1">
              {exact.error ? (
                <ErrorState onRetry={exact.retry} />
              ) : (
                <>
                  <ProductGrid items={exact.items} loading={exact.loading} />
                  <Pagination page={exact.page} total={exact.total} onPageChange={exact.setPage} />
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ia" className="pt-4">
          {!user ? (
            <EmptyState
              title="Inicia sesión para usar la búsqueda inteligente"
              description="La búsqueda por significado encuentra productos aunque no compartan las palabras exactas."
              action={
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={`/login?redirectTo=${encodeURIComponent(
                        query ? `/buscar?q=${query}` : "/buscar",
                      )}`}
                    >
                      Ingresar
                    </Link>
                  }
                />
              }
            />
          ) : !query ? (
            <EmptyState
              title="Escribe algo para buscar"
              description="La búsqueda con IA encuentra productos por significado, no solo por palabras exactas."
            />
          ) : semantic.error ? (
            <ErrorState onRetry={semantic.retry} />
          ) : (
            <ProductGrid
              items={semantic.results}
              loading={semantic.loading}
              emptyTitle="No encontramos productos relacionados"
              emptyDescription="Prueba reformular la búsqueda, por ejemplo describiendo para qué lo necesitas."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={null}>
      <BuscarPageContent />
    </Suspense>
  );
}
