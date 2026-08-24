"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

export interface BuyBoxProps {
  product: Product;
  hasSession: boolean;
  isOwner: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddToCart: (quantity: number) => void;
  onRequireLogin: () => void;
}

export function BuyBox({
  product,
  hasSession,
  isOwner,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
  onRequireLogin,
}: BuyBoxProps) {
  const [quantity, setQuantity] = useState(1);

  // Los 3 motivos que pide la spec, en orden de prioridad: sin sesión no
  // se puede evaluar "es mío", así que va primero.
  const disabledReason = !hasSession
    ? "Inicia sesión para comprar"
    : !product.is_active
      ? "Este producto ya no está disponible"
      : product.stock === 0
        ? "Sin stock"
        : isOwner
          ? "Es tu propio producto"
          : null;

  const canBuy = disabledReason === null;

  function handleFavoriteClick() {
    if (!hasSession) {
      onRequireLogin();
      return;
    }
    onToggleFavorite();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      {canBuy ? (
        <div className="flex items-center gap-2">
          <label htmlFor="buybox-qty" className="text-sm text-muted-foreground">
            Cantidad
          </label>
          <select
            id="buybox-qty"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {Array.from({ length: product.stock }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ) : !hasSession ? (
        <button
          type="button"
          onClick={onRequireLogin}
          className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {disabledReason}
        </button>
      ) : (
        <p className="text-sm font-medium text-destructive">{disabledReason}</p>
      )}

      <div className="flex gap-2">
        <Button className="flex-1" disabled={!canBuy} onClick={() => onAddToCart(quantity)}>
          Agregar al carrito
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          onClick={handleFavoriteClick}
        >
          <Heart
            className={cn("size-4", isFavorite && "fill-destructive text-destructive")}
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>
  );
}
