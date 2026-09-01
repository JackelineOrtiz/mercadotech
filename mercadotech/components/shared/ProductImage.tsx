"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductImageProps {
  src: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  // Fase 7.2 (performance): next/image no precarga sin esto — úsalo SOLO
  // en las tarjetas above-the-fold de la portada (home), nunca en toda la
  // grilla (competiría con la imagen real de LCP, decisión de la spec).
  priority?: boolean;
}

// El seed de la Fase 2.5 guarda rutas de Storage que nunca se subieron
// (documentado a propósito): TODA imagen de producto pasa por aquí, así que
// un 404 real de Storage cae en el mismo placeholder que un src nulo.
export function ProductImage({
  src,
  alt,
  fill = true,
  width,
  height,
  sizes,
  className,
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          fill ? "absolute inset-0" : "",
          className,
        )}
      >
        <ImageOff className="size-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
