"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  RequestPasswordResetForm,
  type RequestPasswordResetFormValues,
} from "@/components/auth/RequestPasswordResetForm";
import { EmptyState } from "@/components/shared/EmptyState";

export default function RecuperarPage() {
  const { requestPasswordReset, loading, error } = useAuth();
  const [sent, setSent] = useState(false);

  async function handleSubmit(values: RequestPasswordResetFormValues) {
    try {
      await requestPasswordReset(values.email);
      // Supabase nunca revela si el correo existe — se muestra la MISMA
      // confirmación exista o no la cuenta, para no permitir enumerar
      // usuarios reales a través de este formulario.
      setSent(true);
    } catch {
      // el error ya queda en el estado de useAuth; el form lo muestra.
    }
  }

  if (sent) {
    return (
      <EmptyState
        title="Revisa tu correo"
        description="Si existe una cuenta con ese correo, te mandamos un enlace para elegir una nueva contraseña."
      />
    );
  }

  return <RequestPasswordResetForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
