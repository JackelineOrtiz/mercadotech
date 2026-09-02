"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm, type LoginFormValues } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/constants/roles";

// Pedido explícito del usuario: cada rol tiene una pantalla "de arranque"
// más útil que el catálogo público genérico — un vendedor entra a
// gestionar su tienda, un admin a gestionar la plataforma. Solo aplica
// cuando NO hay redirectTo explícito (ej. un buyer que intentó entrar a
// una ruta protegida y lo mandaron a loguearse primero — ahí se respeta
// A DÓNDE quería ir, no el default de su rol).
const ROLE_HOME: Record<UserRole, string> = {
  buyer: "/",
  seller: "/vendedor/productos",
  admin: "/admin",
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, error } = useAuth();
  const redirectTo = searchParams.get("redirectTo");

  async function handleSubmit(values: LoginFormValues) {
    try {
      const { profile } = await login(values.email, values.password);
      router.push(redirectTo || ROLE_HOME[profile?.role ?? "buyer"]);
      router.refresh();
    } catch {
      // el error ya queda en el estado de useAuth; el form lo muestra.
    }
  }

  return <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
