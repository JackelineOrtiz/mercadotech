import { Navbar } from "@/components/layout/Navbar";
import { Container } from "@/components/shared/Container";
import type { Category } from "@/types/product";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Valores estáticos por ahora — el layout no conoce Supabase ni hooks
  // todavía. CategoriesMenu se conecta a useCategories en la Fase 3.4;
  // UserMenu a useAuth en la 3.3; CartIndicator a useCart en la 3.6.
  const categories: Category[] = [];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar categories={categories} cartCount={0} user={null} />
      <main className="flex-1">
        <Container className="py-6">{children}</Container>
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MercadoTech — marketplace de laboratorio.
      </footer>
    </div>
  );
}
