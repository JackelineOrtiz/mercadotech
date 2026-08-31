import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CartIndicatorProps {
  count: number;
}

export function CartIndicator({ count }: CartIndicatorProps) {
  return (
    <Link
      href="/carrito"
      data-testid="cart-indicator"
      className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
      aria-label={`Carrito de compras, ${count} ${count === 1 ? "producto" : "productos"}`}
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 ? (
        <Badge
          data-testid="cart-count"
          className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
        >
          {count}
        </Badge>
      ) : null}
    </Link>
  );
}
