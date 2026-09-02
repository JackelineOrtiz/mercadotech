"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Navbar } from "@/components/layout/Navbar";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Container } from "@/components/shared/Container";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { CartProvider, useCart } from "@/hooks/useCart";

// Mismo patrón que (seller)/layout.tsx, con una diferencia real: acá NO
// hay bypass — un vendedor no entra a /admin como sí entra un admin a
// /vendedor/* (canSell de (seller)/layout.tsx incluye "or admin" a
// propósito; isAdmin acá es estrictamente role === 'admin', sin excepción,
// porque este panel expone datos de TODOS los usuarios).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, initializing, logout } = useAuth();
  const { categories } = useCategories();
  const isAdmin = profile?.role === "admin";

  // El middleware (lib/supabase/middleware.ts) ya bloquea a los anónimos
  // en /admin/*; esto cubre el caso más fino que el middleware no resuelve
  // (no consulta profiles): un buyer o seller CON sesión que no es admin.
  useEffect(() => {
    if (initializing) return;
    if (!isAdmin) {
      toast.error("Necesitas una cuenta de administrador");
      router.push("/");
    }
  }, [initializing, isAdmin, router]);

  async function handleLogout() {
    await logout();
    toast.success("Sesión cerrada.");
    router.push("/");
    router.refresh();
  }

  if (initializing || !isAdmin) {
    return (
      <Container className="py-6">
        <LoadingState rows={4} />
      </Container>
    );
  }

  // Mismo hallazgo real que (seller)/layout.tsx (Fase 7.5): Navbar
  // principal + CartProvider propio arriba del sidebar del panel, en vez
  // del chrome aislado que tenía antes — un admin logueado necesita poder
  // volver al catálogo, buscar y llegar a su perfil igual que cualquiera.
  return (
    <CartProvider userId={user?.id}>
      <AdminLayoutContent categories={categories} profile={profile} onLogout={handleLogout}>
        {children}
      </AdminLayoutContent>
    </CartProvider>
  );
}

function AdminLayoutContent({
  categories,
  profile,
  onLogout,
  children,
}: {
  categories: ReturnType<typeof useCategories>["categories"];
  profile: ReturnType<typeof useAuth>["profile"];
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { count: cartCount } = useCart();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar categories={categories} cartCount={cartCount} user={profile} onLogout={onLogout} />

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border md:block">
          <AdminSidebar />
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 border-b border-border p-4 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Abrir menú de administración">
                    <Menu className="size-5" />
                  </Button>
                }
              />
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Panel de administración</SheetTitle>
                </SheetHeader>
                <AdminSidebar />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Panel de administración</span>
          </div>

          <Container className="py-6">{children}</Container>
        </div>
      </div>
    </div>
  );
}
