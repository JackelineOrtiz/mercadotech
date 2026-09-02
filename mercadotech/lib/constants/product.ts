// Vendedor: límites de validación y de imágenes por producto (Fase 3.7).
export const TITLE_MIN = 5;
export const TITLE_MAX = 120;

// = bucket "product-images" (migración de Storage, Fase 2.4): se repite
// aquí para validar en el cliente y dar un error legible ANTES de que
// Storage lo rechace, no porque el bucket pueda cambiar sin tocar código.
export const MAX_IMAGES_PER_PRODUCT = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Tope de cantidad seleccionable en UNA compra, sin importar cuánto stock
// real tenga el producto — hallazgo real (Fase 7.5): con un producto de
// prueba a $555.555.555 y stock=10000, BuyBox ofrecía un <select> con
// 10 000 opciones (1..stock) y dejaba elegir 1553 unidades; total × precio
// desbordó numeric(12,2) de orders.total al finalizar la compra
// ("numeric field overflow" de Postgres, sin traducir, en pleno checkout).
// 10 es realista para un comprador real; capId = min(stock, este valor) en
// TODOS los puntos donde se ofrece elegir cantidad (BuyBox, CartItemRow) y
// donde se recorta (cart.service.addItem/updateQuantity) — no alcanza con
// arreglarlo en un solo lugar.
export const MAX_CART_QUANTITY = 10;
