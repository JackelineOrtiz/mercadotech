import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { RatingStars } from "@/components/shared/RatingStars";
import type { Product } from "@/types/product";

export interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/producto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted">
        <ProductImage src={product.image_url} alt={product.title} />
        {!product.is_active ? (
          <span className="absolute left-2 top-2 rounded bg-foreground/80 px-2 py-0.5 text-xs font-medium text-background">
            No disponible
          </span>
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
            <span className="text-xs font-medium text-destructive">Sin stock</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
