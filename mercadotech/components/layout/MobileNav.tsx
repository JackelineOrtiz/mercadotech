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
        {/* nativeButton={false} en CADA SheetClose de acá abajo: el elemento
            real que renderizan es <Link> (<a>), no un <button> — hallazgo
            real de la auditoría ad-hoc (ver docs/BITACORA.md), encontrado
            en la consola real del navegador ("Base UI: A component that
            acts as a button expected a native <button>..."), pre-existente
            desde que existe este archivo (Sesión 3) y no solo en los links
            agregados en esta auditoría. Mismo fix que ya usa UserMenu.tsx
            para su propio botón con <Link>. */}
        <nav className="flex flex-col gap-1 px-4 pb-4">
          <SheetClose
            nativeButton={false}
            render={<Link href="/" className={LINK_CLASS}>Catálogo</Link>}
          />
          <SheetClose
            nativeButton={false}
            render={<Link href="/favoritos" className={LINK_CLASS}>Favoritos</Link>}
          />
          <SheetClose
            nativeButton={false}
            render={<Link href="/carrito" className={LINK_CLASS}>Carrito</Link>}
          />
          {user ? (
            <SheetClose
              nativeButton={false}
              render={<Link href="/perfil" className={LINK_CLASS}>Mi perfil</Link>}
            />
          ) : null}
          {user ? (
            <SheetClose
              nativeButton={false}
              render={<Link href="/pedidos" className={LINK_CLASS}>Mis pedidos</Link>}
            />
          ) : null}
          {user ? (
            <SheetClose
              nativeButton={false}
              render={<Link href="/asistente" className={LINK_CLASS}>Asistente</Link>}
            />
          ) : null}
          {user ? (
            <SheetClose
              nativeButton={false}
              render={<Link href="/soporte" className={LINK_CLASS}>Soporte</Link>}
            />
          ) : null}
          {canSell ? (
            <SheetClose
              nativeButton={false}
              render={
                <Link href="/vendedor/productos" className={LINK_CLASS}>
                  Panel vendedor
                </Link>
              }
            />
          ) : null}
          {user?.role === "admin" ? (
            <SheetClose
              nativeButton={false}
              render={
                <Link href="/admin" className={LINK_CLASS}>
                  Panel admin
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
                  nativeButton={false}
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
            <SheetClose
              nativeButton={false}
              render={<Link href="/login" className={LINK_CLASS}>Ingresar</Link>}
            />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
