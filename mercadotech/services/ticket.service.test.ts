import { describe, it, expect } from "vitest";
import { listMine } from "@/services/ticket.service";
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
