"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { validateChangePassword, type FieldErrors } from "@/lib/validators/auth";

export interface ChangePasswordFormValues {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordFormProps {
  onSubmit: (values: ChangePasswordFormValues) => void;
  loading?: boolean;
  error?: string | null;
}

// Distinto de NewPasswordForm (que se usa en /actualizar-contrasena, donde
// el link del correo ya prueba identidad): este pide la contraseña ACTUAL
// porque acá la única prueba de identidad es la sesión ambiente del
// navegador — ver el hallazgo real documentado en
// auth.service.changePassword.
export function ChangePasswordForm({
  onSubmit,
  loading = false,
  error,
}: ChangePasswordFormProps) {
  const [values, setValues] = useState<ChangePasswordFormValues>({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateChangePassword(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold">Cambiar contraseña</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="change-password-current">Contraseña actual</Label>
        <PasswordInput
          id="change-password-current"
          data-testid="change-password-current"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={(e) => setValues((v) => ({ ...v, currentPassword: e.target.value }))}
          aria-invalid={!!fieldErrors.currentPassword}
        />
        {fieldErrors.currentPassword ? (
          <p className="text-sm text-destructive">{fieldErrors.currentPassword}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="change-password-new">Nueva contraseña</Label>
        <PasswordInput
          id="change-password-new"
          data-testid="change-password-new"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password ? (
          <p className="text-sm text-destructive">{fieldErrors.password}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="change-password-confirm">Confirmar nueva contraseña</Label>
        <PasswordInput
          id="change-password-confirm"
          data-testid="change-password-confirm"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
          aria-invalid={!!fieldErrors.confirmPassword}
        />
        {fieldErrors.confirmPassword ? (
          <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" data-testid="change-password-submit" disabled={loading}>
        {loading ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
