import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

// Página especial de Next.js (App Router): se renderiza cuando ninguna ruta
// matchea, o cuando un segmento llama a notFound() explícitamente — NO
// entra a ningún layout de grupo de rutas ((shop)/(seller)/(auth)), así
// que no tiene Navbar real (necesitaría hooks/sesión que este archivo no
// puede pedir). Se arma un encabezado mínimo pero de marca en vez de
// dejar el 404 genérico de Next.
export default function NotFound() {
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
            title="Página no encontrada"
            description="El enlace puede estar roto o la página se movió. Volvé al catálogo para seguir buscando."
            action={
              <Button render={<Link href="/">Volver al catálogo</Link>} nativeButton={false} />
            }
          />
        </Container>
      </main>
    </div>
  );
}
