import type { Database } from "@/types/database";

// Sin nombre de autor: profiles solo es legible por su dueño o un admin
// (RLS de la Fase 2.3) — la UI muestra "Usuario", no hay campo para resolver.
export type Question = Database["public"]["Tables"]["questions"]["Row"];
