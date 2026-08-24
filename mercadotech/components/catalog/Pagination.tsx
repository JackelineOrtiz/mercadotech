import { Button } from "@/components/ui/button";
import { PRODUCTS_PAGE_SIZE } from "@/lib/constants/catalog";

export interface PaginationProps {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación de productos"
      className="flex items-center justify-center gap-4 py-6"
    >
      <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      <Button
        variant="outline"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
