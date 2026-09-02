"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";

export default function FavoritosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, loading, error, remove, retry } = useFavorites(user?.id);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Mis favoritos</h1>
      {error ? (
        <ErrorState onRetry={retry} />
      ) : loading ? (
        <ProductGrid items={items} loading={loading} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Todavía no tienes favoritos"
          description="Toca el corazón en cualquier producto para guardarlo aquí."
          action={<Button onClick={() => router.push("/")}>Explorar productos</Button>}
        />
      ) : (
        <ProductGrid items={items} loading={loading} onToggleFavorite={remove} />
      )}
    </div>
  );
}
