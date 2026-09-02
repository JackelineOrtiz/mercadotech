// Productos DEL SEED (supabase/seed.sql, sección "PRODUCTS") usados por los
// specs de la Fase 6.5. IDs y precios reales, no inventados — verificados
// leyendo seed.sql antes de escribir cualquier aserción.
//
// Nota (gana el código real): el prompt de la Fase 6.5 dice "b…06" para el
// producto con stock 0. El seed real muestra que el ÚNICO producto con
// stock 0 es b0000000-...-008 (Router TP-Link Archer C6 AC1200, categoría
// Redes, is_active=true) — b...006 es "Memoria RAM Kingston Fury" con
// stock 20 (con stock normal). Se usa el dato real del seed, documentado
// acá para que quede explícito el porqué del id.

// Precios reescalados (Fase 7.5): el seed original traía precios en escala
// vieja (heredada de antes de la conversión a pesos colombianos, ej. este
// mismo producto en 2199.00) — corregido a valores reales en COP.
export const LAPTOP_WITH_STOCK = {
  id: "b0000000-0000-0000-0000-000000000001",
  title: 'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
  price: 2850000.0,
  stock: 8,
};

// Segunda laptop activa del seed — junto con LAPTOP_WITH_STOCK son las
// ÚNICAS dos laptops visibles en el catálogo público (la tercera, b...009,
// está is_active=false y RLS la oculta del anon/otro comprador).
export const OTHER_LAPTOP = {
  id: "b0000000-0000-0000-0000-000000000002",
  title: 'Laptop HP Pavilion 14" Intel i5 8GB 512GB SSD',
  price: 3150000.0,
};

export const PRODUCT_OUT_OF_STOCK = {
  id: "b0000000-0000-0000-0000-000000000008",
  title: "Router TP-Link Archer C6 AC1200",
  price: 210000.0,
};

export const CATEGORY_LAPTOPS = { name: "Laptops", slug: "laptops" };
