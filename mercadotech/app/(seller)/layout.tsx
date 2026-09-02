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
import { SellerSidebar } from "@/components/layout/SellerSidebar";
import { Container } from "@/components/shared/Container";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { CartProvider, useCart } from "@/hooks/useCart";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, initializing, logout } = useAuth();
  const { categories } = useCategories();
  const canSell = profile ? profile.role === "seller" || profile.role === "admin" : false;

  // El middleware (lib/supabase/middleware.ts) ya bloquea a los anónimos en
  // /vendedor/*; esto cubre el caso más fino que el middleware no resuelve
  // (no consulta profiles): un buyer CON sesión que no es vendedor.
  useEffect(() => {
    if (initializing) return;
    if (!canSell) {
      toast.error("Necesitas una cuenta de vendedor");
      router.push("/");
    }
  }, [initializing, canSell, router]);

  async function handleLogout() {
    await logout();
    toast.success("Sesión cerrada.");
    router.push("/");
    router.refresh();
  }

  if (initializing || !canSell) {
    return (
      <Container className="py-6">
        <LoadingState rows={4} />
      </Container>
    );
  }

  // Hallazgo real probando el smoke test de la Fase 7.5 en producción: el
  // panel de vendedor tenía su propio chrome (sin el Navbar principal) —
  // un vendedor no tenía forma de volver al catálogo, buscar, ver su
  // carrito, ni llegar a "Mi perfil"/cerrar sesión sin salir del panel
  // primero. Se agrega el MISMO Navbar que (shop)/layout.tsx (con su
  // propio CartProvider — un vendedor también puede tener cosas en el
  // carrito como comprador) arriba del sidebar propio del panel, en vez
  // de un logo suelto — consistencia real en toda la app, pedido
  // explícito del usuario.
  return (
    <CartProvider userId={user?.id}>
      <SellerLayoutContent categories={categories} profile={profile} onLogout={handleLogout}>
        {children}
      </SellerLayoutContent>
    </CartProvider>
  );
}

function SellerLayoutContent({
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
      <Navbar
        categories={categories}
        cartCount={cartCount}
        user={profile}
        onLogout={onLogout}
        searchBasePath="/vendedor/productos"
      />

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border md:block">
          <SellerSidebar />
        </aside>

        {/* min-w-0: sin esto, un hijo ancho (ProductsTable, con celdas
            whitespace-nowrap) empuja este flex item más allá del viewport en
            mobile — flex row deja min-width:auto por default, que ignora el
            overflow-x-auto del propio Table y escala TODA la página. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 border-b border-border p-4 md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Abrir menú de vendedor">
                    <Menu className="size-5" />
                  </Button>
                }
              />
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Panel del vendedor</SheetTitle>
                </SheetHeader>
                <SellerSidebar />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Panel del vendedor</span>
          </div>

          <Container className="py-6">{children}</Container>
        </div>
      </div>
    </div>
  );
}
