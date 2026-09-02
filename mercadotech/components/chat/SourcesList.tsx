import Link from "next/link";
import { ProductImage } from "@/components/shared/ProductImage";
import { Price } from "@/components/shared/Price";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChatSource } from "@/types/chat";

export interface SourcesListProps {
  sources: ChatSource[];
  className?: string;
}

const SOURCE_CARD_CLASS =
  "flex w-full items-center gap-2 rounded-md border border-border bg-background p-2 text-left hover:bg-muted";

// Puro: recibe las fuentes ya resueltas por el hook, no conoce el
// endpoint ni cómo se armó el contexto. producto -> mini-card con imagen/
// Price y link real a /producto/[id]; artículo -> título y categoría,
// abre un diálogo con el texto real (mismo contenido que recibió el
// modelo) — antes enlazaba a "/soporte" a secas, sin destino específico
// (placeholder documentado desde la Fase 4.7: "la página del artículo
// individual llega después de esta sesión", nunca construida). Hallazgo
// real de un usuario probando el asistente (Fase 7.5): "esas fuentes
// parecen clickeables pero no es así" — el link a /soporte SÍ navegaba,
// pero no llevaba a nada relacionado con lo que se citó, se sentía roto.
export function SourcesList({ sources, className }: SourcesListProps) {
  if (sources.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">Fuentes</p>
      <ul className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <li key={`${source.source_type}-${source.source_id}`}>
            {source.source_type === "producto" ? (
              <Link href={`/producto/${source.source_id}`} className={SOURCE_CARD_CLASS}>
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
              <Dialog>
                <DialogTrigger
                  render={
                    <button type="button" className={SOURCE_CARD_CLASS}>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        [{source.index}]
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{source.title}</p>
                        {source.category ? (
                          <p className="text-xs text-muted-foreground">{source.category}</p>
                        ) : null}
                      </div>
                    </button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{source.title}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 text-sm whitespace-pre-line text-muted-foreground">
                    {source.content}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
