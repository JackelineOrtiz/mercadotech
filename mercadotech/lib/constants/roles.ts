// Roles de usuario (columna profiles.role).
export type UserRole = "buyer" | "seller" | "admin";
export const USER_ROLES: readonly UserRole[] = ["buyer", "seller", "admin"];

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
