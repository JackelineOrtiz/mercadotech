import Link from "next/link";
import { Heart } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { RatingStars } from "@/components/shared/RatingStars";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

export interface ProductCardProps {
  // similarity es opcional a propósito (Fase 4.4): solo lo trae la pestaña
  // "Resultados con IA" de /buscar — el catálogo normal y el resto de
  // ProductGrid nunca lo pasan.
  product: Product & { similarity?: number };
  // Fase 7.2 (performance): solo ProductGrid en la home lo pasa, y solo
  // para las primeras tarjetas (above-the-fold) — ver ese componente.
  priority?: boolean;
  // Fase 7.5, hallazgo real: /favoritos no tenía forma de desmarcar un
  // producto salvo entrando a su ficha — solo ProductGrid de /favoritos
  // pasa esto, el resto del catálogo (home, categoría, búsqueda, tienda)
  // nunca lo necesita. preventDefault+stopPropagation porque el botón
  // vive DENTRO del <Link> de toda la tarjeta.
  onToggleFavorite?: (productId: string) => void;
}

// Mismos breakpoints que GRID_CLASS de ProductGrid (1 col mobile, 2 sm,
// 3 lg, 4 xl) — sin esto next/image asume sizes="100vw" con fill y pide
// la imagen más grande posible aunque la tarjeta ocupe 1/4 del ancho.
const CARD_IMAGE_SIZES =
  "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export function ProductCard({
  product,
  priority = false,
  onToggleFavorite,
}: ProductCardProps) {
  return (
    <Link
      href={`/producto/${product.id}`}
      data-testid="product-card"
      className="group flex flex-col overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted">
        <ProductImage
          src={product.image_url}
          alt={product.title}
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
        />
        {!product.is_active ? (
          <span className="absolute left-2 top-2 rounded bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
            No disponible
          </span>
        ) : null}
        {product.similarity !== undefined ? (
          <span className="absolute top-2 right-2 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            {Math.round(product.similarity * 100)}% similar
          </span>
        ) : null}
        {onToggleFavorite ? (
          <button
            type="button"
            data-testid="product-card-unfavorite"
            aria-label="Quitar de favoritos"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
            className="absolute top-2 right-2 rounded-full bg-background/90 p-1.5 text-destructive shadow-sm hover:bg-background"
          >
            <Heart className={cn("size-4", "fill-destructive")} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <ConditionBadge condition={product.condition} className="w-fit" />
        <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
        {product.review_count > 0 ? (
          <div className="flex items-center gap-1">
            <RatingStars value={product.average_rating ?? 0} size={12} />
            <span className="text-xs text-muted-foreground">({product.review_count})</span>
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-1">
          <Price value={product.price} size="md" />
          {product.stock === 0 ? (
            <span className="text-xs font-medium text-destructive">Sin unidades</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
