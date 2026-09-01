"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import { useSellerPublicProfile } from "@/hooks/useSellerPublicProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Pagination } from "@/components/catalog/Pagination";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";

// Fuera del PDF de la spec: storefront público del vendedor (ver
// docs/BITACORA.md, "Trabajo ad-hoc"). Mismo patrón que /categoria/[slug]
// — reusa useProducts (con sellerId en vez de categorySlug),
// FiltersPanel/ProductGrid/Pagination tal cual, sin componentes nuevos
// para la grilla. Lo único nuevo es el header con el perfil público del
// vendedor (useSellerPublicProfile -> vista public_profiles).
function TiendaPageContent() {
  const params = useParams<{ sellerId: string }>();
  const { profile, loading: profileLoading } = useSellerPublicProfile(params.sellerId);

  const { items, total, page, loading, error, filters, setFilter, setPage, retry } = useProducts({
    sellerId: params.sellerId,
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

  // null tras terminar de cargar: o el id no existe, o no es un vendedor
  // (public_profiles solo lista role = 'seller') — mismo mensaje para los
  // dos casos, no hay forma de distinguirlos desde acá ni falta hacerlo.
  if (!profileLoading && !profile) {
    return (
      <EmptyState
        title="Tienda no encontrada"
        description="Este vendedor no existe o ya no está disponible."
      />
    );
  }

  const initials = (profile?.display_name?.trim() || "V").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Avatar size="lg">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-bold">{profile?.display_name ?? "Tienda"}</h1>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <FiltersPanel value={filters} onChange={handleFiltersChange} />
        <div className="min-w-0 flex-1">
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

export default function TiendaPage() {
  return (
    <Suspense fallback={null}>
      <TiendaPageContent />
    </Suspense>
  );
}
