// Roles de usuario (columna profiles.role).
export type UserRole = "buyer" | "seller" | "admin";
export const USER_ROLES: readonly UserRole[] = ["buyer", "seller", "admin"];

// Fuera del PDF de la spec: panel de admin (ver docs/BITACORA.md) —
// primer lugar que necesita mostrar el rol como texto legible.
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  buyer: "Comprador",
  seller: "Vendedor",
  admin: "Admin",
};

// Variantes ya definidas en components/ui/badge.tsx — mismo patrón que
// ORDER_STATUS_BADGE_VARIANT (lib/constants/orders.ts).
export const USER_ROLE_BADGE_VARIANT: Record<
  UserRole,
  "default" | "secondary" | "outline" | "destructive"
> = {
  buyer: "outline",
  seller: "secondary",
  admin: "default",
};

// Estados de un pedido (columna orders.status).
export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

// Estados de un ticket de soporte (columna support_tickets.status).
export type TicketStatus =
  | "abierto"
  | "en_proceso"
  | "resuelto"
  | "cerrado";
export const TICKET_STATUSES: readonly TicketStatus[] = [
  "abierto",
  "en_proceso",
  "resuelto",
  "cerrado",
];

// Condición física de un producto (columna products.condition).
export type ProductCondition = "nuevo" | "usado" | "reacondicionado";
export const PRODUCT_CONDITIONS: readonly ProductCondition[] = [
  "nuevo",
  "usado",
  "reacondicionado",
];
