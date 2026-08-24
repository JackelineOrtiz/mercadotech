import { Price } from "@/components/shared/Price";
import { ConditionBadge } from "@/components/shared/ConditionBadge";
import type { Product } from "@/types/product";

export interface ProductInfoProps {
  product: Product;
}

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ConditionBadge condition={product.condition} />
        {product.brand ? (
          <span className="text-sm text-muted-foreground">{product.brand}</span>
        ) : null}
      </div>
      <h1 className="text-2xl font-bold">{product.title}</h1>
      <Price value={product.price} size="lg" />
      <p className="text-sm text-muted-foreground">
        {product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}
      </p>
      {product.description ? (
        <p className="mt-2 text-sm text-foreground/90">{product.description}</p>
      ) : null}
    </div>
  );
}
