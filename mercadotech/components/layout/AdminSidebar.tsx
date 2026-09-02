import { NavLink } from "@/components/layout/NavLink";

const LINKS = [
  // exact:true en "/admin": a diferencia de SellerSidebar (sin rutas
  // anidadas entre sí), acá "/admin" ES prefijo de "/admin/usuarios" — sin
  // exact, NavLink marcaría el Dashboard como activo también en /usuarios.
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/usuarios", label: "Usuarios", exact: false },
];

// Mismo patrón que SellerSidebar (components/layout/SellerSidebar.tsx).
export function AdminSidebar() {
  return (
    <nav className="flex flex-col gap-1 p-4" aria-label="Panel de administración">
      {LINKS.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          exact={link.exact}
          className="rounded-md px-3 py-2 hover:bg-muted"
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
