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
}

export function Price({ value, size = "md", className }: PriceProps) {
  return (
    <span className={cn(SIZE_CLASSES[size], className)}>
      {formatPrice(value)}
    </span>
  );
}
