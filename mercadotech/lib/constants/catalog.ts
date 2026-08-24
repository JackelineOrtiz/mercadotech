// Múltiplo de 2, 3 y 4 columnas (los breakpoints del grid en
// ProductGrid.tsx) para que la última fila de cada página nunca quede a
// medias sin importar el ancho de pantalla.
export const PRODUCTS_PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortOption = "recientes";

// Rango por defecto del filtro de precio. El producto más caro del seed
// (Fase 2.5) cuesta S/ 2,499 — 5,000 deja margen sin ser un rango absurdo
// que haga inútil al slider/inputs en la práctica.
export const PRICE_RANGE_DEFAULT = { min: 0, max: 5000 };
