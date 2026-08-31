// Pedidos DEL SEED (supabase/seed.sql, sección "ORDERS + ORDER_ITEMS")
// usados por la Fase 6.6. Verificados leyendo el seed real antes de
// escribir cualquier aserción — el prompt de la fase avisa explícitamente
// que hay que comprobarlo, no asumirlo (la spec anterior se equivocó una
// vez asumiendo en vez de leer).
//
// Los 6 pedidos del seed, con su dueño real (vendedor de sus order_items):
//   c…001 entregado  buyer1  MULTI-vendedor: seller1 (Lenovo) + seller2 (HyperX)
//   c…002 pendiente  buyer1  seller1 (Samsung Galaxy)
//   c…003 pagado     buyer2  seller2 (Logitech G413 + Razer DeathAdder) — ÚNICO 'pagado'
//   c…004 enviado    buyer2  seller1 (Monitor LG) — un solo ítem, NO multi-vendedor
//   c…005 cancelado  buyer3  seller1 (Xiaomi Redmi Note)
//   c…006 entregado  buyer3  seller1 (JBL Flip) + seller1 (HP Pavilion)
//
// Conclusión (gana el código real sobre lo que el prompt asumía "el
// multi-vendedor c…04" es impreciso — el multi-vendedor real es c…001,
// y está 'entregado', no 'enviado'): el ÚNICO pedido 'pagado' del seed
// pertenece a SELLER2, comprado por BUYER2 — seller1 no tiene ningún
// pedido 'pagado' para mover. seller-flow.spec.ts usa seller2/buyer2.
// seller1 sí tiene un pedido 'enviado' (c…004) — se usa para el negativo
// de "retroceder enviado → pagado" en seller-negative.spec.ts.

export const ORDER_PAGADO_SELLER2 = {
  id: "c0000000-0000-0000-0000-000000000003",
  buyer: "buyer2" as const,
  seller: "seller2" as const,
};

export const ORDER_ENVIADO_SELLER1 = {
  id: "c0000000-0000-0000-0000-000000000004",
  buyer: "buyer2" as const,
  seller: "seller1" as const,
};
