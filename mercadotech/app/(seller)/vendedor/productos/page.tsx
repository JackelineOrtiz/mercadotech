"use client";

import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProducts } from "@/hooks/useSellerProducts";
import { ProductsTable } from "@/components/seller/ProductsTable";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";

export default function VendedorProductosPage() {
  const { profile } = useAuth();
  const { items, loading, error, toggleActive, remove, retry } = useSellerProducts(profile?.id);

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
      ) : (
        <ProductsTable products={items} onToggleActive={handleToggle} onDelete={handleDelete} />
      )}
    </div>
  );
}
