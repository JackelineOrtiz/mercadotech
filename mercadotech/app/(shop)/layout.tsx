"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/shared/Container";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useCart } from "@/hooks/useCart";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { categories } = useCategories();
  const { count: cartCount } = useCart(user?.id);

  // SearchBar ya navega a /buscar?q= por sí sola (Fase 3.2) — no necesita
  // conectarse a nada aquí.

  async function handleLogout() {
    await logout();
    toast.success("Sesión cerrada.");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        categories={categories}
        cartCount={cartCount}
        user={profile}
        onLogout={handleLogout}
      />
      <main className="flex-1">
        <Container className="py-6">{children}</Container>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MercadoTech — marketplace de laboratorio.
      </footer>
    </div>
  );
}
