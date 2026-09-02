import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Ticket } from "@/types/ticket";
import type { TicketStatus } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

export async function listMine(
  userId: string,
  supabase: Client = createClient(),
): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({ ...row, status: row.status as TicketStatus }));
}

// Fase 7.5 (fuera del alcance original — "decisión 5 de la spec" lo había
// pospuesto a la Sesión 8, agente de voz; pedido explícito del usuario de
// construirlo ahora igual, encontrado al probar en vivo que el asistente
// SUGIERE abrir un ticket sin que existiera ninguna forma real de
// hacerlo). Dos inserts secuenciales, no una RPC: si el segundo (el
// mensaje) fallara después del primero (el ticket), queda un ticket sin
// mensaje — un caso borde tolerable para esta feature, no justifica la
// complejidad de una función transaccional como create_order_from_cart
// (ahí sí, por el stock compartido entre carritos concurrentes).
// channel: "chat" fijo — el ticket SIEMPRE se origina desde el asistente
// de /soporte, no hay otro punto de entrada en la UI todavía ("voz"
// llega recién en la Sesión 8).
export async function createTicket(
  userId: string,
  subject: string,
  message: string,
  supabase: Client = createClient(),
): Promise<Ticket> {
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({ user_id: userId, subject, channel: "chat" })
    .select("*")
    .single();
  if (ticketError) throw ticketError;

  const { error: messageError } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticket.id, sender_role: "usuario", content: message });
  if (messageError) throw messageError;

  return { ...ticket, status: ticket.status as TicketStatus };
}
