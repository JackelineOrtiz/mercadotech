import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import { cn } from "@/lib/utils";
import type { ChatSource } from "@/types/chat";

export interface SourcesListProps {
  sources: ChatSource[];
  className?: string;
}

// Puro: recibe las fuentes ya resueltas por el hook, no conoce el
// endpoint ni cómo se armó el contexto. producto -> mini-card con imagen/
// Price y link a /producto/[id]; artículo -> título y categoría, ancla al
// propio /soporte (la página del artículo individual llega después de
// esta sesión).
export function SourcesList({ sources, className }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">Fuentes</p>
      <ul className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <li key={`${source.source_type}-${source.source_id}`}>
            {source.source_type === "producto" ? (
              <Link
                href={`/producto/${source.source_id}`}
                className="flex items-center gap-2 rounded-md border border-border bg-background p-2 hover:bg-muted"
              >
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  [{source.index}]
                </span>
                <div className="relative size-10 shrink-0 overflow-hidden rounded border border-border">
                  <ProductImage src={source.image_url ?? null} alt={source.title} sizes="40px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{source.title}</p>
                  {source.price !== undefined ? <Price value={source.price} size="sm" /> : null}
                </div>
              </Link>
            ) : (
              <Link
                href="/soporte"
                className="flex items-center gap-2 rounded-md border border-border bg-background p-2 hover:bg-muted"
              >
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  [{source.index}]
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{source.title}</p>
                  {source.category ? (
                    <p className="text-xs text-muted-foreground">{source.category}</p>
                  ) : null}
                </div>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
