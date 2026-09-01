import Link from "next/link";
import { NavLink } from "@/components/layout/NavLink";

const LINKS = [
  { href: "/vendedor/productos", label: "Mis productos" },
  { href: "/vendedor/pedidos", label: "Pedidos" },
  { href: "/vendedor/publicar", label: "Publicar" },
];

export function SellerSidebar() {
  return (
    <nav className="flex flex-col gap-1 p-4" aria-label="Panel del vendedor">
      {/* Hallazgo real probando el panel en producción (Fase 7.5): sin
          esto, un vendedor no tenía NINGUNA forma de volver a la tienda
          desde acá — el layout de (seller) no renderiza el Navbar
          principal a propósito (chrome propio, mismo patrón que (admin)),
          pero eso dejó afuera hasta el link de vuelta. */}
      <Link href="/" className="mb-2 px-3 text-lg font-bold text-primary">
        MercadoTech
      </Link>
      {LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          className="rounded-md px-3 py-2 hover:bg-muted"
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
