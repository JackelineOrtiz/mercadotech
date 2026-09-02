"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProducts } from "@/hooks/useSellerProducts";
import { useCategories } from "@/hooks/useCategories";
import { ProductsTable } from "@/components/seller/ProductsTable";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";

// Fase 7.5, hallazgo real: el buscador y "Categorías" del Navbar, dentro
// del panel del vendedor, siempre te sacaban al catálogo público — pedido
// explícito de que ahí filtren "Mis productos" en el lugar. Navbar (vía
// (seller)/layout.tsx, searchBasePath="/vendedor/productos") navega acá
// con ?q=/?category=slug; el filtrado es client-side porque
// useSellerProducts ya trae TODOS los productos del vendedor de una — un
// catálogo de un solo vendedor nunca justifica paginar en el servidor
// como sí lo hace el catálogo público completo.
function VendedorProductosPageContent() {
  const { profile } = useAuth();
  const { items, loading, error, toggleActive, remove, retry } = useSellerProducts(profile?.id);
  const { categories } = useCategories();
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim().toLowerCase();
  const categorySlug = searchParams.get("category");

  const filteredItems = useMemo(() => {
    let result = items;
    if (categorySlug) {
      const category = categories.find((c) => c.slug === categorySlug);
      result = category ? result.filter((p) => p.category_id === category.id) : result;
    }
    if (q) {
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }
    return result;
  }, [items, categories, categorySlug, q]);

  async function handleToggle(id: string, isActive: boolean) {
    try {
      await toggleActive(id, isActive);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
      toast.success("Producto eliminado.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState onRetry={retry} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis productos</h1>
        <Button
          nativeButton={false}
          render={<Link href="/vendedor/publicar">Publicar producto</Link>}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Aún no tienes productos"
          description="Publica tu primer producto para empezar a vender."
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Ningún producto coincide con el filtro"
          description="Probá con otro término de búsqueda o categoría."
        />
      ) : (
        <ProductsTable products={filteredItems} onToggleActive={handleToggle} onDelete={handleDelete} />
      )}
    </div>
  );
}

export default function VendedorProductosPage() {
  return (
    <Suspense fallback={null}>
      <VendedorProductosPageContent />
    </Suspense>
  );
}
