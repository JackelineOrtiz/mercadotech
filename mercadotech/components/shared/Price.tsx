import { cn, formatPrice } from "@/lib/utils";

type PriceSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<PriceSize, string> = {
  sm: "text-sm",
  md: "text-base font-semibold",
  lg: "text-2xl font-bold",
};

export interface PriceProps {
  value: number | string;
  size?: PriceSize;
  className?: string;
  // Fase 6.4 (E2E): Price no acepta props arbitrarias (no hace spread de
  // ...rest), así que un data-testid en un caller no llegaría al <span> sin
  // este prop explícito — opcional, no cambia el comportamiento existente.
  testId?: string;
}

export function Price({ value, size = "md", className, testId }: PriceProps) {
  return (
    <span data-testid={testId} className={cn(SIZE_CLASSES[size], className)}>
      {formatPrice(value)}
    </span>
  );
}
