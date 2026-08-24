"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { validateRegister, type FieldErrors } from "@/lib/validators/auth";
import type { UserRole } from "@/lib/constants/roles";

export interface RegisterFormValues {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisterFormProps {
  onSubmit: (values: RegisterFormValues) => void;
  loading?: boolean;
  error?: string | null;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "buyer", label: "Quiero comprar" },
  { value: "seller", label: "Quiero vender" },
];

export function RegisterForm({ onSubmit, loading = false, error }: RegisterFormProps) {
  const [values, setValues] = useState<RegisterFormValues>({
    displayName: "",
    email: "",
    password: "",
    role: "buyer",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateRegister(values);
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
      <h1 className="text-xl font-semibold">Crear cuenta</h1>

      <div className="flex flex-col gap-1.5">
        <Label id="register-role-label">Quiero…</Label>
        <div
          role="radiogroup"
          aria-labelledby="register-role-label"
          className="grid grid-cols-2 gap-2"
        >
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={values.role === option.value}
              onClick={() => setValues((v) => ({ ...v, role: option.value }))}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                values.role === option.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {fieldErrors.role ? (
          <p className="text-sm text-destructive">{fieldErrors.role}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-name">Nombre</Label>
        <Input
          id="register-name"
          autoComplete="name"
          value={values.displayName}
          onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
          aria-invalid={!!fieldErrors.displayName}
        />
        {fieldErrors.displayName ? (
          <p className="text-sm text-destructive">{fieldErrors.displayName}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-email">Correo electrónico</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email ? (
          <p className="text-sm text-destructive">{fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="register-password">Contraseña</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password ? (
          <p className="text-sm text-destructive">{fieldErrors.password}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Ingresa
        </Link>
      </p>
    </form>
  );
}
