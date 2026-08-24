import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  rows?: number;
  className?: string;
}

// Skeleton en vez de un spinner genérico: cada pantalla con datos usa esto
// (o su propio skeleton específico, ej. ProductCardSkeleton en 3.4) mientras
// carga — nunca un ícono girando sin forma del contenido real.
export function LoadingState({ rows = 3, className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
