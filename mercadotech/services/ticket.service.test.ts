import { describe, it, expect } from "vitest";
import { listMine, createTicket } from "@/services/ticket.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("ticket.service.listMine", () => {
  it("filtra por user_id, ordena por created_at desc y castea status a TicketStatus", async () => {
    const supabase = mockSupabase({
      support_tickets: {
        select: [{ id: "t1", user_id: "u1", status: "abierto", subject: "Ayuda", created_at: "2026-01-01" }],
      },
    });

    const tickets = await listMine("u1", supabase);

    expect(tickets).toEqual([
      { id: "t1", user_id: "u1", status: "abierto", subject: "Ayuda", created_at: "2026-01-01" },
    ]);
    const call = supabase.calls.find((c) => c.table === "support_tickets" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ support_tickets: { error: { message: "permission denied" } } });
    await expect(listMine("u1", supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});

// Fase 7.5 (fuera del alcance original — construido por pedido explícito
// del usuario, ver el comentario de cabecera de ticket.service.ts). Dos
// inserts secuenciales: support_tickets primero (channel: "chat" fijo),
// ticket_messages después con el ticket.id ya devuelto.
describe("ticket.service.createTicket", () => {
  it("inserta el ticket (channel='chat') y su primer mensaje (sender_role='usuario')", async () => {
    const supabase = mockSupabase({
      support_tickets: {
        single: { id: "t1", user_id: "u1", subject: "Ayuda", status: "abierto", created_at: "2026-01-01" },
      },
      ticket_messages: {},
    });

    const ticket = await createTicket("u1", "Ayuda", "No me llegó el pedido", supabase);

    expect(supabase.inserts("support_tickets")).toContainEqual({
      user_id: "u1",
      subject: "Ayuda",
      channel: "chat",
    });
    expect(supabase.inserts("ticket_messages")).toContainEqual({
      ticket_id: "t1",
      sender_role: "usuario",
      content: "No me llegó el pedido",
    });
    expect(ticket).toEqual({
      id: "t1",
      user_id: "u1",
      subject: "Ayuda",
      status: "abierto",
      created_at: "2026-01-01",
    });
  });

  it("propaga el error de crear el ticket tal cual, sin intentar el mensaje", async () => {
    const supabase = mockSupabase({
      support_tickets: { error: { message: "permission denied for table support_tickets" } },
    });
    await expect(createTicket("u1", "Ayuda", "texto", supabase)).rejects.toMatchObject({
      message: "permission denied for table support_tickets",
    });
    expect(supabase.calls.some((c) => c.table === "ticket_messages")).toBe(false);
  });

  it("propaga el error de crear el mensaje tal cual (el ticket ya quedó creado)", async () => {
    const supabase = mockSupabase({
      support_tickets: {
        single: { id: "t1", user_id: "u1", subject: "Ayuda", status: "abierto", created_at: "2026-01-01" },
      },
      ticket_messages: { error: { message: "permission denied for table ticket_messages" } },
    });
    await expect(createTicket("u1", "Ayuda", "texto", supabase)).rejects.toMatchObject({
      message: "permission denied for table ticket_messages",
    });
  });
});
