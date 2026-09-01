import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  // Sin href: es la página actual — se muestra sin link, como texto plano
  // (mismo criterio que un breadcrumb estándar: nunca "volver a donde ya
  // estás").
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

// Hallazgo real probando el smoke test de la Fase 7.5 en producción
// (usuario en vivo, no un caso hipotético): páginas anidadas — el detalle
// de un producto/pedido, editar un producto — no tenían NINGUNA forma de
// volver al listado padre salvo el menú general. Se agrega acá, como
// componente compartido, para no repetir el mismo layout de migas en cada
// página que lo necesite.
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Miga de pan" className={cn("flex flex-wrap items-center gap-1 text-sm", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-muted-foreground hover:text-foreground hover:underline">
                {item.label}
              </Link>
            ) : (
              <span
                className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
