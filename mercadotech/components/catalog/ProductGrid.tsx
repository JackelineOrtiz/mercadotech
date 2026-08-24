import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types/product";

export interface ProductGridProps {
  items: Product[];
  loading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

const GRID_CLASS = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const SKELETON_COUNT = 8;

export function ProductGrid({
  items,
  loading,
  emptyTitle = "No encontramos productos",
  emptyDescription = "Prueba ajustando los filtros o la búsqueda.",
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={GRID_CLASS} aria-busy="true" aria-live="polite">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
        <span className="sr-only">Cargando productos…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={GRID_CLASS}>
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg border border-border p-3">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
