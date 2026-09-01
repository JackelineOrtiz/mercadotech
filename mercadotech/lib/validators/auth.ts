import type { UserRole } from "@/lib/constants/roles";

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginInput {
  email: string;
  password: string;
}

export function validateLogin(input: LoginInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.email.trim()) {
    errors.email = "Ingresa tu correo.";
  } else if (!EMAIL_RE.test(input.email)) {
    errors.email = "Correo inválido.";
  }

  if (!input.password) {
    errors.password = "Ingresa tu contraseña.";
  }

  return errors;
}

export interface RequestPasswordResetInput {
  email: string;
}

export function validateRequestPasswordReset(input: RequestPasswordResetInput): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.email.trim()) {
    errors.email = "Ingresa tu correo.";
  } else if (!EMAIL_RE.test(input.email)) {
    errors.email = "Correo inválido.";
  }

  return errors;
}

export interface NewPasswordInput {
  password: string;
  confirmPassword: string;
}

export function validateNewPassword(input: NewPasswordInput): FieldErrors {
  const errors: FieldErrors = {};

  if (input.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return errors;
}

export interface UpdateProfileInput {
  displayName: string;
  phone: string;
}

// Mismo rango de displayName que register (2-60): es la misma columna
// (profiles.display_name), la misma regla de negocio la escriba quien la
// escriba. phone es opcional (columna nullable) — si viene vacío no es
// error; si viene con contenido, se exige un mínimo de dígitos reales para
// atajar el typo más común ("solo puse el código de país").
const PHONE_DIGITS_RE = /\d/g;

export function validateUpdateProfile(input: UpdateProfileInput): FieldErrors {
  const errors: FieldErrors = {};
  const nameLength = input.displayName.trim().length;

  if (nameLength < 2 || nameLength > 60) {
    errors.displayName = "El nombre debe tener entre 2 y 60 caracteres.";
  }

  const phoneDigits = input.phone.match(PHONE_DIGITS_RE)?.length ?? 0;
  if (input.phone.trim() && phoneDigits < 6) {
    errors.phone = "Ingresa un teléfono válido.";
  }

  return errors;
}

export interface ChangePasswordInput {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

// Mismas reglas que validateNewPassword para password/confirmPassword, más
// currentPassword obligatoria (a diferencia de la recuperación por correo,
// acá SÍ hace falta probar que quien cambia la contraseña conoce la
// actual — ver auth.service.changePassword).
export function validateChangePassword(input: ChangePasswordInput): FieldErrors {
  const errors = validateNewPassword(input);

  if (!input.currentPassword) {
    errors.currentPassword = "Ingresa tu contraseña actual.";
  }

  return errors;
}

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
}

export function validateRegister(input: RegisterInput): FieldErrors {
  const errors: FieldErrors = {};
  const nameLength = input.displayName.trim().length;

  if (nameLength < 2 || nameLength > 60) {
    errors.displayName = "El nombre debe tener entre 2 y 60 caracteres.";
  }

  if (!input.email.trim()) {
    errors.email = "Ingresa tu correo.";
  } else if (!EMAIL_RE.test(input.email)) {
    errors.email = "Correo inválido.";
  }

  if (input.password.length < 8) {
    errors.password = "La contraseña debe tener al menos 8 caracteres.";
  }

  if (input.role !== "buyer" && input.role !== "seller") {
    errors.role = "Elige si quieres comprar o vender.";
  }

  return errors;
}
