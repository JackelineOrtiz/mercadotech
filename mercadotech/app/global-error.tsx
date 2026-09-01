"use client";

import { useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Hallazgo real de la auditoría ad-hoc (ver docs/BITACORA.md): error.tsx
// (raíz de app/) captura errores de CUALQUIER Server/Client Component bajo
// el árbol que envuelve RootLayout — pero NO errores del propio
// app/layout.tsx (el <ThemeProvider>/<Toaster>/fuentes que arma el html y
// el body). Next.js exige un archivo SEPARADO para eso, y con una regla
// especial: como reemplaza TODO el árbol (incluido <html>/<body> de
// RootLayout), tiene que declarar los suyos propios — nunca puede
// componerse dentro de RootLayout como hace error.tsx.
//
// A propósito NO se reusan Container/EmptyState/Button/next/link de
// error.tsx acá, aunque ninguno depende de ThemeProvider (verificado): si
// este archivo se está ejecutando es porque algo en el árbol de
// RootLayout ya falló — cuantas menos dependencias tenga esta pantalla de
// último recurso (sin next/link, que depende del router; solo <a href>
// planas), menos chance de que ELLA también falle. Mismo look visual que
// error.tsx, pero con HTML/Tailwind puros.
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
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-border">
            <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
              <span className="text-lg font-bold text-primary">MercadoTech</span>
            </div>
          </header>
          <main className="flex flex-1 items-center justify-center px-4 py-16">
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-xl font-semibold">Algo salió mal</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                Ocurrió un error inesperado al cargar la aplicación. Podés reintentar o volver
                al inicio.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                >
                  Reintentar
                </button>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                    <a> plana a propósito, no next/link: este archivo reemplaza
                    TODO el árbol de RootLayout porque algo ahí ya falló — un
                    <Link> que dependa del router de Next agregaría una
                    dependencia más justo en la pantalla de último recurso. */}
                <a
                  href="/"
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  Volver al inicio
                </a>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
