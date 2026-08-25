// Vendedor: límites de validación y de imágenes por producto (Fase 3.7).
export const TITLE_MIN = 5;
export const TITLE_MAX = 120;

// = bucket "product-images" (migración de Storage, Fase 2.4): se repite
// aquí para validar en el cliente y dar un error legible ANTES de que
// Storage lo rechace, no porque el bucket pueda cambiar sin tocar código.
export const MAX_IMAGES_PER_PRODUCT = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
