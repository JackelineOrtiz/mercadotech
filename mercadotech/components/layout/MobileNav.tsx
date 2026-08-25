"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Category } from "@/types/product";
import type { Profile } from "@/types/user";

export interface MobileNavProps {
  categories: Category[];
  user: Profile | null;
  onLogout?: () => void;
}

const LINK_CLASS = "rounded-md px-2 py-2 hover:bg-muted";

export function MobileNav({ categories, user, onLogout }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const canSell = user ? user.role === "seller" || user.role === "admin" : false;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>MercadoTech</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4 pb-4">
          <SheetClose render={<Link href="/" className={LINK_CLASS}>Catálogo</Link>} />
          <SheetClose
            render={<Link href="/favoritos" className={LINK_CLASS}>Favoritos</Link>}
          />
          <SheetClose render={<Link href="/carrito" className={LINK_CLASS}>Carrito</Link>} />
          {user ? (
            <SheetClose
              render={<Link href="/pedidos" className={LINK_CLASS}>Mis pedidos</Link>}
            />
          ) : null}
          {user ? (
            <SheetClose
              render={<Link href="/asistente" className={LINK_CLASS}>Asistente</Link>}
            />
          ) : null}
          {user ? (
            <SheetClose
              render={<Link href="/soporte" className={LINK_CLASS}>Soporte</Link>}
            />
          ) : null}
          {canSell ? (
            <SheetClose
              render={
                <Link href="/vendedor/productos" className={LINK_CLASS}>
                  Panel vendedor
                </Link>
              }
            />
          ) : null}

          {categories.length > 0 ? (
            <>
              <div className="my-2 border-t border-border" />
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Categorías
              </p>
              {categories.map((category) => (
                <SheetClose
                  key={category.id}
                  render={
                    <Link href={`/categoria/${category.slug}`} className={LINK_CLASS}>
                      {category.name}
                    </Link>
                  }
                />
              ))}
            </>
          ) : null}

          <div className="my-2 border-t border-border" />
          {user ? (
            <button type="button" onClick={onLogout} className={`${LINK_CLASS} text-left`}>
              Cerrar sesión
            </button>
          ) : (
            <SheetClose render={<Link href="/login" className={LINK_CLASS}>Ingresar</Link>} />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
