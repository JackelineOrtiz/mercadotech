import type { Database } from "@/types/database";
import type { UserRole } from "@/lib/constants/roles";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"] & {
  role: UserRole;
  // Resuelta por auth.service.getSession a partir de avatar_path (mismo
  // patrón que product.service con image_url) — nunca se resuelve en un
  // componente. null si el usuario no tiene avatar todavía.
  avatar_url: string | null;
};
