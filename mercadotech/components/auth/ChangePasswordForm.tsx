"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateChangePassword, type FieldErrors } from "@/lib/validators/auth";

const EMPTY_VALUES = { currentPassword: "", password: "", confirmPassword: "" };

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
// Hallazgo real (Fase 7.5): el form ni avisaba que cambiar la contraseña
// cierra la sesión (ver perfil/page.tsx), ni se limpiaba después de
// guardar. Ahora el submit del <form> abre un diálogo de confirmación
// ANTES de llamar a onSubmit — "Sí" ejecuta el cambio real (el caller
// hace logout+redirect si sale bien), "No" cancela y limpia los campos
// (pedido explícito del usuario, no solo cierra el diálogo dejando el
// texto viejo ahí).
export function ChangePasswordForm({
  onSubmit,
  loading = false,
  error,
}: ChangePasswordFormProps) {
  const [values, setValues] = useState<ChangePasswordFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateChangePassword(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    setConfirmOpen(false);
    onSubmit(values);
  }

  function handleCancelConfirm() {
    setConfirmOpen(false);
    setValues(EMPTY_VALUES);
    setFieldErrors({});
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

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && handleCancelConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar tu contraseña?</DialogTitle>
            <DialogDescription>
              Por seguridad, vas a cerrar sesión apenas se guarde el cambio — vas a tener que
              volver a iniciar sesión con la contraseña nueva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancelConfirm}>
              No, cancelar
            </Button>
            <Button type="button" data-testid="change-password-confirm-dialog" onClick={handleConfirm}>
              Sí, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
