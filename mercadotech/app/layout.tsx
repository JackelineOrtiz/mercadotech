import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/useAuth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MercadoTech",
  description:
    "Marketplace de productos tecnológicos con soporte por agentes de voz.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {/* AuthProvider en la raíz, no en (shop)/layout.tsx: (shop)/
              (seller)/(admin)/(auth) son grupos de rutas HERMANOS bajo
              esta misma raíz — ninguno anida a los otros, así que el
              Provider tiene que vivir acá arriba para que los cuatro
              compartan una sola instancia real de sesión (hallazgo real,
              ver hooks/useAuth.tsx). */}
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
