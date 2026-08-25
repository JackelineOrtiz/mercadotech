import type { OrderStatus } from "@/lib/constants/roles";

// Secuencia de avance normal de un pedido. RLS permite que el vendedor
// ponga cualquier estado en un pedido con ítems suyos (no valida orden) —
// la Fase 3.7 usa esta lista para rechazar en el hook cualquier salto que
// no sea "un paso adelante", antes de llegar al service.
export const ORDER_STATUS_FLOW: OrderStatus[] = ["pendiente", "pagado", "enviado", "entregado"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Variantes ya definidas en components/ui/badge.tsx — sin colores propios.
export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pendiente: "secondary",
  pagado: "default",
  enviado: "default",
  entregado: "outline",
  cancelado: "destructive",
};
