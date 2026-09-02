import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// numeric(12,2) (price, total, price_snapshot) llega como string desde
// PostgREST — esta es la única función que formatea precios en toda la app,
// para no repetir el parseo de string en cada componente.
//
// Pesos colombianos (COP), no soles peruanos (PEN) — pedido explícito del
// usuario (Fase 7.5). Confirmado corriendo Intl.NumberFormat de verdad
// antes de cambiar: es-CO formatea con "." para miles y "," para
// decimales (ej. "$ 1.234.567,89") — es el formato colombiano real, no
// una mezcla a mano.
//
// minimumFractionDigits/maximumFractionDigits forzados a 2: sin esto,
// COP por default en Intl usa 0 decimales (redondea al peso entero,
// dato real de ISO 4217 — confirmado corriendo el formatter antes de
// decidir), lo que perdería precisión visual real contra
// products.price (numeric(12,2)) — dos precios distintos como "199.90"
// y "199.40" mostrarían el mismo valor redondeado. Se fuerza a 2 para
// que la vista siga reflejando el dato real, aunque no sea la costumbre
// habitual de Colombia para pesos.
//
// Nota: el contenido de ejemplo (nombres de vendedores, FAQ de soporte,
// instrucciones de sistema de la IA) que seguía ambientado en Perú ya se
// corrigió aparte (Fase 7.5, seed.sql/seed.prod.sql + lib/ai/prompts.ts) —
// no formaba parte de este fix de formato de moneda.
const priceFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  return priceFormatter.format(numeric);
}
