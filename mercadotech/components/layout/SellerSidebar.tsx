import { NavLink } from "@/components/layout/NavLink";

const LINKS = [
  { href: "/vendedor/productos", label: "Mis productos" },
  { href: "/vendedor/pedidos", label: "Pedidos" },
  // Fase 7.5: antes solo se podía responder entrando a la página pública
  // de cada producto — sin ningún link acá que lo dijera.
  { href: "/vendedor/preguntas", label: "Preguntas" },
  { href: "/vendedor/publicar", label: "Publicar" },
];

export function SellerSidebar() {
  return (
    <nav className="flex flex-col gap-1 p-4" aria-label="Panel del vendedor">
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
