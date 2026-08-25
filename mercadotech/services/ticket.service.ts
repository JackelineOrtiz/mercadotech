import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Ticket } from "@/types/ticket";
import type { TicketStatus } from "@/lib/constants/roles";

type Client = SupabaseClient<Database>;

// Solo lectura (decisión 5 de la spec): crear tickets desde la UI llega
// con el agente de la Sesión 8. Por ahora un ticket solo puede originarse
// por el seed o directo en Postgres.
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
