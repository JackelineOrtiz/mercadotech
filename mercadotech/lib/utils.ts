import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// numeric(12,2) (price, total, price_snapshot) llega como string desde
// PostgREST — esta es la única función que formatea precios en toda la app,
// para no repetir el parseo de string en cada componente.
const priceFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
});

export function formatPrice(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  return priceFormatter.format(numeric);
}
