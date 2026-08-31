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
