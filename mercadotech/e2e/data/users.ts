// Usuarios DEL SEED (supabase/seed.sql, sección "USUARIOS") — no se crean
// usuarios nuevos por test para no ensuciar el dataset ni pagar el costo de
// un signup real en cada spec. Contraseña común de laboratorio para los 6
// usuarios del seed: "MercadoTech123!" (bcrypt vía pgcrypto, ver el
// comentario de cabecera de seed.sql).
export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

const PASSWORD = "MercadoTech123!";

export const BUYER1: TestUser = {
  email: "buyer1@mercadotech.test",
  password: PASSWORD,
  displayName: "María Fernanda Quispe",
};

export const SELLER1: TestUser = {
  email: "seller1@mercadotech.test",
  password: PASSWORD,
  displayName: "TecnoStore Colombia",
};

// Agregados en la Fase 6.6: el único pedido 'pagado' del seed (c…003)
// pertenece a seller2, comprado por buyer2 — no hay ningún 'pagado' de
// seller1 (ver e2e/data/orders.ts). El flujo del kanban necesita ambos.
export const BUYER2: TestUser = {
  email: "buyer2@mercadotech.test",
  password: PASSWORD,
  displayName: "Jorge Luis Ramírez",
};

export const SELLER2: TestUser = {
  email: "seller2@mercadotech.test",
  password: PASSWORD,
  displayName: "Gamer Zone Colombia",
};
