"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

// Error boundary especial de Next.js (App Router): DEBE ser Client
// Component. Captura cualquier error no manejado que escape de un Server
// o Client Component bajo app/ — sin este archivo, ese error tumba toda la
// pantalla con la overlay de desarrollo (o una página en blanco en
// producción) en vez de un estado recuperable. Mismo motivo que
// not-found.tsx: no entra a ningún layout de grupo de rutas, así que no
// tiene Navbar real.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center">
          <Link href="/" className="text-lg font-bold text-primary">
            MercadoTech
          </Link>
        </Container>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <Container className="py-16">
          <EmptyState
            title="Algo salió mal"
            description="Ocurrió un error inesperado. Podés reintentar o volver al catálogo."
            action={
              <div className="flex gap-2">
                <Button onClick={() => reset()}>Reintentar</Button>
                <Button
                  variant="outline"
                  render={<Link href="/">Volver al catálogo</Link>}
                  nativeButton={false}
                />
              </div>
            }
          />
        </Container>
      </main>
    </div>
  );
}
