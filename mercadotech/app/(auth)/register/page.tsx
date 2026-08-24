"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RegisterForm, type RegisterFormValues } from "@/components/auth/RegisterForm";
import { useAuth } from "@/hooks/useAuth";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, loading, error } = useAuth();
  const redirectTo = searchParams.get("redirectTo") || "/";

  async function handleSubmit(values: RegisterFormValues) {
    try {
      const data = await register(values);
      if (data.session) {
        // Supabase local tiene enable_confirmations = false: el registro
        // inicia sesión de inmediato.
        router.push(redirectTo);
        router.refresh();
      } else {
        // En un proyecto hosted con confirmación de correo activa, signUp
        // no devuelve sesión hasta que el usuario confirma.
        toast.info("Revisa tu correo para confirmar tu cuenta.");
        router.push("/login");
      }
    } catch {
      // el error ya queda en el estado de useAuth; el form lo muestra.
    }
  }

  return <RegisterForm onSubmit={handleSubmit} loading={loading} error={error} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
