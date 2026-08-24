"use client";

import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ErrorState } from "@/components/shared/ErrorState";

export default function FavoritosPage() {
  const { user } = useAuth();
  const { items, loading, error, retry } = useFavorites(user?.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Mis favoritos</h1>
      {error ? (
        <ErrorState onRetry={retry} />
      ) : (
        <ProductGrid
          items={items}
          loading={loading}
          emptyTitle="Todavía no tienes favoritos"
          emptyDescription="Toca el corazón en cualquier producto para guardarlo aquí."
        />
      )}
    </div>
  );
}
