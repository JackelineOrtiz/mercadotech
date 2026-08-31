"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/shared/Container";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { CartProvider, useCart } from "@/hooks/useCart";
import type { Category } from "@/types/product";
import type { Profile } from "@/types/user";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { categories } = useCategories();

  async function handleLogout() {
    await logout();
    toast.success("Sesión cerrada.");
    router.push("/");
    router.refresh();
  }

  // CartProvider envuelve TODO (Navbar + children): una única instancia real
  // de useCart para toda la sección (shop)/ — antes cada página que la
  // llamaba (Navbar, /producto/[id], /carrito) tenía su propio estado
  // aislado, así que agregar un ítem desde la ficha de producto nunca
  // actualizaba el contador del Navbar (hallazgo real de la Fase 6.5,
  // documentado en hooks/useCart.tsx).
  return (
    <CartProvider userId={user?.id}>
      <ShopLayoutContent categories={categories} profile={profile} onLogout={handleLogout}>
        {children}
      </ShopLayoutContent>
    </CartProvider>
  );
}

function ShopLayoutContent({
  categories,
  profile,
  onLogout,
  children,
}: {
  categories: Category[];
  profile: Profile | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const { count: cartCount } = useCart();

  // SearchBar ya navega a /buscar?q= por sí sola (Fase 3.2) — no necesita
  // conectarse a nada aquí.
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        categories={categories}
        cartCount={cartCount}
        user={profile}
        onLogout={onLogout}
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
