import { TITLE_MIN, TITLE_MAX } from "@/lib/constants/product";

export type FieldErrors = Record<string, string>;

export interface ProductValidationInput {
  title: string;
  price: number;
  stock: number;
  categoryId: string;
  imageCount: number;
}

export function validateProduct(input: ProductValidationInput): FieldErrors {
  const errors: FieldErrors = {};
  const titleLength = input.title.trim().length;

  if (titleLength < TITLE_MIN || titleLength > TITLE_MAX) {
    errors.title = `El título debe tener entre ${TITLE_MIN} y ${TITLE_MAX} caracteres.`;
  }

  if (!(input.price > 0)) {
    errors.price = "El precio debe ser mayor a 0.";
  }

  if (!Number.isInteger(input.stock) || input.stock < 0) {
    errors.stock = "El stock debe ser 0 o más.";
  }

  if (!input.categoryId) {
    errors.categoryId = "Elige una categoría.";
  }

  if (input.imageCount < 1) {
    errors.images = "Agrega al menos una imagen.";
  }

  return errors;
}
