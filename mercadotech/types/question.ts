import type { Database } from "@/types/database";

// Sin nombre de autor: profiles solo es legible por su dueño o un admin
// (RLS de la Fase 2.3) — la UI muestra "Usuario", no hay campo para resolver.
export type Question = Database["public"]["Tables"]["questions"]["Row"];

// Vista del vendedor sobre TODAS sus preguntas (pendientes y respondidas),
// agregadas de todos sus productos (Fase 7.5 — antes solo se podían
// responder entrando a la página pública de cada producto, sin ningún
// lugar en el panel que las juntara). productTitle es de solo lectura,
// resuelto por el service — nunca se vuelve a pedir product.title por
// separado en la UI.
//
// Se llamó "PendingQuestion" en su primera versión (Fase 7.5, hallazgo real
// #1): el service solo traía las sin responder, así que una pregunta
// respondida por el vendedor DESAPARECÍA de esta pantalla sin dejar rastro
// — no había forma de ver después ni lo que le habían preguntado ni lo que
// había contestado. Renombrado a SellerQuestion cuando el service pasó a
// traer todas (Fase 7.5, hallazgo real #2): el nombre "Pending" ya no
// describía el contenido real de la lista.
export type SellerQuestion = Question & { productTitle: string };

// Vista del comprador sobre las preguntas QUE ÉL HIZO, a través de
// productos distintos (Fase 7.5, hallazgo real: no existía ningún lugar
// para revisar después una pregunta ya hecha ni si ya tenía respuesta —
// había que recordar en qué producto se había preguntado y volver a esa
// ficha). productImageUrl ya resuelto (misma convención que el resto de
// la app: la UI nunca recibe un image_path crudo), null si el producto no
// tiene ninguna imagen cargada.
export type MyQuestion = Question & { productTitle: string; productImageUrl: string | null };
