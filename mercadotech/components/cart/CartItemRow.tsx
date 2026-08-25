import { X } from "lucide-react";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/types/cart";

export interface CartItemRowProps {
  item: CartItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartItemRow({ item, onQuantityChange, onRemove }: CartItemRowProps) {
  if (!item.product) {
    return (
      <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
          <ProductImage src={null} alt="Producto ya no disponible" />
        </div>
        <p className="flex-1 text-sm text-muted-foreground">
          Este producto ya no está disponible.
        </p>
        <Button variant="ghost" size="icon" aria-label="Quitar del carrito" onClick={onRemove}>
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border">
        <ProductImage src={item.product.imageUrl} alt={item.product.title} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium">{item.product.title}</p>
        <Price value={item.product.price} size="sm" />
      </div>
      <select
        aria-label={`Cantidad de ${item.product.title}`}
        value={item.quantity}
        onChange={(e) => onQuantityChange(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {Array.from({ length: item.product.stock }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="icon" aria-label="Quitar del carrito" onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
