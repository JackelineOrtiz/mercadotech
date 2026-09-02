"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { useProductPreview } from "@/hooks/useProductPreview";

export interface ProductPreviewDialogProps {
  // null = cerrado. Pasar un id lo abre y dispara la carga.
  productId: string | null;
  onOpenChange: (open: boolean) => void;
}

// Fase 7.5, hallazgo real: desde /vendedor/preguntas, el link al producto
// sacaba al vendedor a SU PROPIA ficha pública completa — con "Es tu
// propio producto" y "Agregar al carrito" deshabilitado, sin preguntar/
// reseñar/favoritos con ningún sentido ahí (es su propio producto). Este
// diálogo muestra SOLO lo que un comprador vería (imagen, condición,
// stock, precio, descripción) — nunca esas acciones de comprador, porque
// para el vendedor viendo su propio producto ninguna aplica.
export function ProductPreviewDialog({ productId, onOpenChange }: ProductPreviewDialogProps) {
  const { product, loading, error } = useProductPreview(productId);

  return (
    <Dialog open={!!productId} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product?.title ?? "Vista previa del producto"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <LoadingState rows={3} />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : product ? (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-muted">
              <ProductImage src={product.image_url} alt={product.title} sizes="400px" />
            </div>
            <div className="flex items-center gap-2">
              <ConditionBadge condition={product.condition} />
              {product.stock === 0 ? (
                <span className="text-xs font-medium text-destructive">Sin unidades</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {product.stock === 1
                    ? "1 unidad disponible"
                    : `${product.stock} unidades disponibles`}
                </span>
              )}
            </div>
            <Price value={product.price} size="lg" />
            {product.description ? (
              <p className="text-sm whitespace-pre-line text-foreground/90">
                {product.description}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
