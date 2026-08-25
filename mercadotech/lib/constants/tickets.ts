import type { TicketStatus } from "@/lib/constants/roles";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

// Variantes ya definidas en components/ui/badge.tsx — sin colores propios,
// mismo patrón que ORDER_STATUS_BADGE_VARIANT (lib/constants/orders.ts).
export const TICKET_STATUS_BADGE_VARIANT: Record<
  TicketStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  abierto: "destructive",
  en_proceso: "default",
  resuelto: "outline",
  cerrado: "secondary",
};
