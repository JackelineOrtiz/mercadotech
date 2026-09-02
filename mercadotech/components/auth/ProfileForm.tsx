"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateUpdateProfile, type FieldErrors } from "@/lib/validators/auth";

export interface ProfileFormValues {
  displayName: string;
  phone: string;
}

export interface ProfileFormProps {
  initialValues: ProfileFormValues;
  avatarUrl: string | null;
  // Fase 7.5, hallazgo real: page.tsx ya capturaba user.email (lo necesita
  // changePassword para reautenticar) pero nunca llegaba a la UI — "Mi
  // perfil" no mostraba con qué correo estás logueado. Solo lectura: el
  // email se cambia desde Supabase Auth, no desde `profiles` — no hay
  // `onEmailChange` acá a propósito.
  email: string;
  onSubmit: (values: ProfileFormValues) => void;
  onAvatarChange: (file: File) => void;
  loading?: boolean;
  error?: string | null;
}

// Componente puro: recibe avatarUrl ya resuelta (nunca el avatar_path
// crudo — mismo principio que ProductImage con image_url) y sube el
// archivo a través de onAvatarChange, sin tocar Storage ni el service
// directamente (regla #1 del architecture-enforcer).
export function ProfileForm({
  initialValues,
  avatarUrl,
  email,
  onSubmit,
  onAvatarChange,
  loading = false,
  error,
}: ProfileFormProps) {
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initials = (initialValues.displayName.trim() || "U").slice(0, 2).toUpperCase();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateUpdateProfile(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(values);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se limpia el input después de leerlo: sin esto, volver a elegir el
    // MISMO archivo (ej. reintentar tras un error) no dispara onChange,
    // porque el value del input no cambió.
    event.target.value = "";
    if (file) onAvatarChange(file);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
    >
      <h1 className="text-xl font-semibold">Mi perfil</h1>

      <div className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarImage src={avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="profile-avatar-change"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
          >
            Cambiar foto
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            data-testid="profile-avatar-input"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Correo</Label>
        <Input id="profile-email" data-testid="profile-email" value={email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          El correo no se puede cambiar desde acá.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-display-name">Nombre</Label>
        <Input
          id="profile-display-name"
          data-testid="profile-display-name"
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
        <Label htmlFor="profile-phone">Teléfono</Label>
        <Input
          id="profile-phone"
          data-testid="profile-phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
          aria-invalid={!!fieldErrors.phone}
        />
        {fieldErrors.phone ? (
          <p className="text-sm text-destructive">{fieldErrors.phone}</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" data-testid="profile-submit" disabled={loading}>
        {loading ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
