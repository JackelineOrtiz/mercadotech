"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { NewPasswordForm, type NewPasswordFormValues } from "@/components/auth/NewPasswordForm";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

// El link del correo de recuperación trae el token en el FRAGMENTO de la
// URL (#access_token=...&type=recovery) — el fragmento nunca llega al
// servidor (por eso esta ruta NO está en PROTECTED_PREFIXES de
// middleware.ts: si lo estuviera, el middleware vería "sin sesión" y
// redirigiría a /login antes de que el cliente pudiera leer el fragmento).
// El cliente de Supabase (@supabase/ssr, detectSessionInUrl: true por
// defecto) lo procesa solo al montar — por eso se espera a que useAuth
// termine de inicializar antes de decidir si el enlace es válido.
export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const { user, initializing, updatePassword, loading, error } = useAuth();

  async function handleSubmit(values: NewPasswordFormValues) {
    try {
      await updatePassword(values.password);
      toast.success("Contraseña actualizada.");
      router.push("/");
      router.refresh();
    } catch {
      // el error ya queda en el estado de useAuth; el form lo muestra.
    }
  }

  if (initializing) {
    return <LoadingState rows={2} />;
  }

  if (!user) {
    return (
      <EmptyState
        title="Enlace inválido o expirado"
        description="Los enlaces de recuperación duran poco tiempo. Pedí uno nuevo."
        action={
          <Button render={<Link href="/recuperar">Solicitar de nuevo</Link>} nativeButton={false} />
        }
      />
    );
  }

  return <NewPasswordForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
