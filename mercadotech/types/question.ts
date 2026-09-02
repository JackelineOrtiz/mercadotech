import type { Database } from "@/types/database";

// Sin nombre de autor: profiles solo es legible por su dueño o un admin
// (RLS de la Fase 2.3) — la UI muestra "Usuario", no hay campo para resolver.
export type Question = Database["public"]["Tables"]["questions"]["Row"];

// Vista del vendedor sobre SUS preguntas sin responder, agregadas de
// todos sus productos (Fase 7.5 — antes solo se podían responder entrando
// a la página pública de cada producto, sin ningún lugar en el panel que
// las juntara). productTitle es de solo lectura, resuelto por el service —
// nunca se vuelve a pedir product.title por separado en la UI.
export type PendingQuestion = Question & { productTitle: string };
