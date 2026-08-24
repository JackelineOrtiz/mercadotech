"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SellerSidebar } from "@/components/layout/SellerSidebar";
import { Container } from "@/components/shared/Container";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // PUNTO DE EXTENSIÓN (Fase 3.3): cuando useAuth exista, si
  // profile.role no es 'seller' ni 'admin' -> toast "Necesitas una cuenta
  // de vendedor" + redirect a "/". No se implementa aquí a propósito.

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <SellerSidebar />
      </aside>

      <div className="flex-1">
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
  );
}
