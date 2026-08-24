import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/user";

export interface UserMenuProps {
  user: Profile | null;
  onLogout?: () => void;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  if (!user) {
    // nativeButton=false: el elemento real es <Link> (<a>), no un <button> —
    // sin esto Base UI advierte que perdió la semántica nativa de botón.
    return (
      <Button render={<Link href="/login">Ingresar</Link>} size="sm" nativeButton={false} />
    );
  }

  const canSell = user.role === "seller" || user.role === "admin";
  const initials = (user.display_name?.trim() || "U").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Menú de usuario"
            className="rounded-full focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Avatar>
              <AvatarImage src={user.avatar_path ?? undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        }
      />

      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/pedidos">Mis pedidos</Link>} />
        <DropdownMenuItem render={<Link href="/favoritos">Favoritos</Link>} />
        {canSell ? (
          <DropdownMenuItem
            render={<Link href="/vendedor/productos">Panel vendedor</Link>}
          />
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout}>Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
