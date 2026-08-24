"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
}

const STARS = [1, 2, 3, 4, 5];

export function RatingStars({
  value,
  onChange,
  size = 16,
  className,
}: RatingStarsProps) {
  const readOnly = !onChange;

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Calificación: ${value} de 5 estrellas`}
    >
      {STARS.map((star) => {
        const filled = star <= Math.round(value);

        if (readOnly) {
          return (
            <Star
              key={star}
              size={size}
              className={cn(
                filled ? "fill-primary text-primary" : "fill-none text-muted-foreground",
              )}
            />
          );
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
            onClick={() => onChange(star)}
            className="rounded-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Star
              size={size}
              className={cn(
                filled ? "fill-primary text-primary" : "fill-none text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
