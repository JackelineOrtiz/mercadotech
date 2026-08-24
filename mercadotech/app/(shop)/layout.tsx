"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/shared/Container";
import { useAuth } from "@/hooks/useAuth";
import type { Category } from "@/types/product";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { profile, logout } = useAuth();

  // categories llega en la Fase 3.4 (useCategories); cartCount en la 3.6
  // (useCart).
  const categories: Category[] = [];

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
        cartCount={0}
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
