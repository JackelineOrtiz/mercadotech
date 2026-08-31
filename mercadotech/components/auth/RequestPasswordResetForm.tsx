"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateRequestPasswordReset, type FieldErrors } from "@/lib/validators/auth";

export interface RequestPasswordResetFormValues {
  email: string;
}

export interface RequestPasswordResetFormProps {
  onSubmit: (values: RequestPasswordResetFormValues) => void;
  loading?: boolean;
  error?: string | null;
}

export function RequestPasswordResetForm({
  onSubmit,
  loading = false,
  error,
}: RequestPasswordResetFormProps) {
  const [values, setValues] = useState<RequestPasswordResetFormValues>({ email: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateRequestPasswordReset(values);
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
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa tu correo y te mandamos un enlace para elegir una nueva contraseña.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-email">Correo electrónico</Label>
        <Input
          id="reset-email"
          data-testid="reset-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues({ email: e.target.value })}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email ? (
          <p className="text-sm text-destructive">{fieldErrors.email}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" data-testid="reset-submit" disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Volver a ingresar
        </Link>
      </p>
    </form>
  );
}
