"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ProfileForm, type ProfileFormValues } from "@/components/auth/ProfileForm";
import {
  ChangePasswordForm,
  type ChangePasswordFormValues,
} from "@/components/auth/ChangePasswordForm";
import { LoadingState } from "@/components/shared/LoadingState";

// Bajo PROTECTED_PREFIXES (lib/supabase/middleware.ts) — a diferencia de
// actualizar-contrasena, esta ruta SÍ necesita sesión normal para
// llegar, así que el middleware alcanza para protegerla.
export default function PerfilPage() {
  const { user, profile, initializing, updateProfile, uploadAvatar, changePassword } = useAuth();

  // Estado de loading/error LOCAL a esta página, uno por sección — a
  // propósito, NO se usa el loading/error compartido de useAuth acá.
  // Hallazgo real probado en vivo: con el loading/error único de
  // UseAuthState (pensado para login/register/etc., que viven cada uno en
  // su propia página), un "Invalid login credentials" al fallar el cambio
  // de contraseña aparecía bajo el formulario de NOMBRE, no bajo el de
  // contraseña — las tres acciones de esta página comparten esa página,
  // así que necesitan cada una su propio error visible en el lugar correcto.
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (initializing) {
    return <LoadingState rows={3} />;
  }

  if (!profile || !user?.email) {
    // El middleware ya redirige a /login sin sesión — esto es solo la
    // ventana entre "initializing pasó a false" y la redirección real.
    // user.email también se exige acá: changePassword lo necesita para
    // reautenticar, y todo usuario de este proyecto se registra con correo.
    return null;
  }

  // Capturados en consts propias: TypeScript no propaga el narrowing de
  // "if (!profile || !user?.email) return null" hacia adentro de estas
  // funciones anidadas (son closures, no el mismo scope de control flow) —
  // profile.id/user.email directo ahí adentro seguirían marcados como
  // "possibly null/undefined".
  const userId = profile.id;
  const userEmail = user.email;

  async function handleProfileSubmit(values: ProfileFormValues) {
    setProfileSubmitting(true);
    setProfileError(null);
    try {
      await updateProfile(userId, { displayName: values.displayName, phone: values.phone });
      toast.success("Perfil actualizado.");
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleAvatarChange(file: File) {
    setAvatarUploading(true);
    try {
      await uploadAvatar(userId, file);
      toast.success("Foto de perfil actualizada.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handlePasswordSubmit(values: ChangePasswordFormValues) {
    setPasswordSubmitting(true);
    setPasswordError(null);
    try {
      await changePassword(userEmail, values.currentPassword, values.password);
      toast.success("Contraseña actualizada.");
    } catch (err) {
      // Incluye el caso real de Supabase "Invalid login credentials" si la
      // contraseña actual ingresada es incorrecta.
      setPasswordError((err as Error).message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <ProfileForm
        initialValues={{
          displayName: profile.display_name ?? "",
          phone: profile.phone ?? "",
        }}
        avatarUrl={profile.avatar_url}
        email={userEmail}
        onSubmit={handleProfileSubmit}
        onAvatarChange={handleAvatarChange}
        loading={profileSubmitting || avatarUploading}
        error={profileError}
      />

      <ChangePasswordForm
        onSubmit={handlePasswordSubmit}
        loading={passwordSubmitting}
        error={passwordError}
      />
    </div>
  );
}
