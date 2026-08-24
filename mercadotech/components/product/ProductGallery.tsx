"use client";

import { useState, type KeyboardEvent } from "react";
import { ProductImage } from "@/components/shared/ProductImage";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageType } from "@/types/product";

export interface ProductGalleryProps {
  images: ProductImageType[];
  productTitle: string;
}

export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const current = sorted[index];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      setIndex((i) => Math.min(i + 1, sorted.length - 1));
    } else if (event.key === "ArrowLeft") {
      setIndex((i) => Math.max(i - 1, 0));
    }
  }

  return (
    <div className="flex flex-col gap-3" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
        <ProductImage src={current?.image_url ?? null} alt={productTitle} />
      </div>
      {sorted.length > 1 ? (
        <div className="flex gap-2">
          {sorted.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Imagen ${i + 1} de ${sorted.length}`}
              aria-current={i === index}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-md border-2",
                i === index ? "border-primary" : "border-transparent",
              )}
            >
              <ProductImage src={image.image_url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
