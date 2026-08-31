import { describe, it, expect } from "vitest";
import { listPublished } from "@/services/support-article.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("support-article.service.listPublished", () => {
  it("filtra is_published=true y ordena por category, luego title", async () => {
    const supabase = mockSupabase({ support_articles: { select: [] } });
    await listPublished(supabase);
    const call = supabase.calls.find((c) => c.table === "support_articles" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["is_published", true] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["category"] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["title"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ support_articles: { error: { message: "permission denied" } } });
    await expect(listPublished(supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});
