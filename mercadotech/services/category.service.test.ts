import { describe, it, expect } from "vitest";
import { listCategories } from "@/services/category.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("category.service.listCategories", () => {
  it("ordena por name", async () => {
    const supabase = mockSupabase({
      categories: { select: [{ id: "c1", name: "Laptops", slug: "laptops" }] },
    });
    const categories = await listCategories(supabase);
    expect(categories).toHaveLength(1);
    const call = supabase.calls.find((c) => c.table === "categories" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "order", args: ["name"] });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ categories: { error: { message: "permission denied" } } });
    await expect(listCategories(supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});
