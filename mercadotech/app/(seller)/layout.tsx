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
import { SellerSidebar } from "@/components/layout/SellerSidebar";
import { Container } from "@/components/shared/Container";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { profile, initializing } = useAuth();
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

  if (initializing || !canSell) {
    return (
      <Container className="py-6">
        <LoadingState rows={4} />
      </Container>
    );
  }

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
