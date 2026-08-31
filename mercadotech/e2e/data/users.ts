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
  displayName: "TecnoStore Perú",
};
