import { Badge } from "@/components/ui/badge";
import type { ProductCondition } from "@/lib/constants/roles";

const LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

// Variantes ya definidas en components/ui/badge.tsx — sin colores propios:
// "nuevo" es la condición más vendible, se resalta con el color de marca.
const VARIANTS: Record<ProductCondition, "default" | "secondary" | "outline"> = {
  nuevo: "default",
  usado: "secondary",
  reacondicionado: "outline",
};

export interface ConditionBadgeProps {
  condition: ProductCondition;
  className?: string;
}

export function ConditionBadge({ condition, className }: ConditionBadgeProps) {
  return (
    <Badge variant={VARIANTS[condition]} className={className}>
      {LABELS[condition]}
    </Badge>
  );
}
