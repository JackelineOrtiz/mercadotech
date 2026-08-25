import Link from "next/link";
import { SearchBar } from "@/components/layout/SearchBar";
import { CategoriesMenu } from "@/components/layout/CategoriesMenu";
import { CartIndicator } from "@/components/layout/CartIndicator";
import { UserMenu } from "@/components/layout/UserMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import type { Category } from "@/types/product";
import type { Profile } from "@/types/user";

export interface NavbarProps {
  categories: Category[];
  cartCount: number;
  user: Profile | null;
  onLogout?: () => void;
}

// Compone todo por props — no hace fetching. Cada pieza se conecta a su
// hook en una fase posterior (ver tabla "Cómo se conectan los componentes
// del navbar" de la spec): UserMenu -> useAuth (3.3), CategoriesMenu ->
// useCategories (3.4), CartIndicator -> useCart (3.6).
export function Navbar({ categories, cartCount, user, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav categories={categories} user={user} onLogout={onLogout} />

        <Link href="/" className="shrink-0 text-lg font-bold text-primary">
          MercadoTech
        </Link>

        <div className="hidden md:block">
          <CategoriesMenu categories={categories} />
        </div>

        {/* < 768px: el resto de la fila (menú, logo, carrito, usuario) ya
            son shrink-0, así que en 375px este flex-1 quedaba con ~48px
            reales — muy poco para escribir una búsqueda. Se oculta aquí y
            se repite abajo en su propia fila a ancho completo. */}
        <div className="hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <CartIndicator count={cartCount} />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>

      <div className="border-t border-border px-4 pb-3 pt-2 md:hidden">
        <SearchBar />
      </div>
    </header>
  );
}
