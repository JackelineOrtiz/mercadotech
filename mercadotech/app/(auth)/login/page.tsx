"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginForm, type LoginFormValues } from "@/components/auth/LoginForm";
import { useAuth } from "@/hooks/useAuth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, error } = useAuth();
  const redirectTo = searchParams.get("redirectTo") || "/";

  async function handleSubmit(values: LoginFormValues) {
    try {
      await login(values.email, values.password);
      router.push(redirectTo);
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
