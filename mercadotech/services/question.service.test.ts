import { describe, it, expect } from "vitest";
import { listByProduct, listByUser, getById, create, answer } from "@/services/question.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

// Fase 7.5, hallazgo real: no había forma de que un comprador revisara
// después las preguntas que había hecho. Join anidado a products (no dos
// queries, a diferencia de seller.service.listMyQuestions).
describe("question.service.listByUser", () => {
  it("filtra por user_id, ordena por created_at desc y resuelve título+portada del producto", async () => {
    const supabase = mockSupabase({
      questions: {
        select: [
          {
            id: "q1",
            product_id: "p1",
            user_id: "u1",
            question: "¿Trae cargador?",
            answer: "Sí.",
            answered_at: "2026-01-02T00:00:00.000Z",
            created_at: "2026-01-02",
            products: {
              title: "Laptop",
              product_images: [
                { image_path: "s1/p1/1.jpg", position: 1 },
                { image_path: "s1/p1/0.jpg", position: 0 },
              ],
            },
          },
          {
            id: "q2",
            product_id: "p2",
            user_id: "u1",
            question: "¿Es inalámbrico?",
            answer: null,
            answered_at: null,
            created_at: "2026-01-01",
            products: { title: "Mouse", product_images: [] },
          },
        ],
      },
    });

    const questions = await listByUser("u1", supabase);

    const call = supabase.calls.find((c) => c.table === "questions" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["user_id", "u1"] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });

    expect(questions[0]).toMatchObject({
      id: "q1",
      productTitle: "Laptop",
      productImageUrl: expect.stringContaining("s1/p1/0.jpg"),
    });
    // Sin product_images: portada null, no revienta.
    expect(questions[1]).toMatchObject({ id: "q2", productTitle: "Mouse", productImageUrl: null });
  });

  it("producto borrado (products null): productTitle vacío, productImageUrl null", async () => {
    const supabase = mockSupabase({
      questions: {
        select: [
          {
            id: "q1",
            product_id: "p1",
            user_id: "u1",
            question: "¿Trae cargador?",
            answer: null,
            answered_at: null,
            created_at: "2026-01-01",
            products: null,
          },
        ],
      },
    });

    const questions = await listByUser("u1", supabase);

    expect(questions[0]).toMatchObject({ productTitle: "", productImageUrl: null });
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ questions: { error: { message: "permission denied" } } });
    await expect(listByUser("u1", supabase)).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("question.service.listByProduct", () => {
  it("filtra por product_id y ordena por created_at desc", async () => {
    const supabase = mockSupabase({ questions: { select: [] } });
    await listByProduct("p1", supabase);
    const call = supabase.calls.find((c) => c.table === "questions" && c.op === "select");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["product_id", "p1"] });
    expect(call?.chain).toContainEqual({ method: "order", args: ["created_at", { ascending: false }] });
  });
});

describe("question.service.getById", () => {
  it("devuelve la pregunta puntual por id (agregada en la Fase 5.4 para el prompt MCP)", async () => {
    const supabase = mockSupabase({
      questions: { single: { id: "q1", product_id: "p1", user_id: "u1", question: "¿Trae cargador?" } },
    });
    const question = await getById("q1", supabase);
    expect(question.id).toBe("q1");
  });

  it("propaga el error tal cual si no existe", async () => {
    const supabase = mockSupabase({ questions: { error: { message: "no encontrado" } } });
    await expect(getById("q1", supabase)).rejects.toMatchObject({ message: "no encontrado" });
  });
});

describe("question.service.create", () => {
  it("inserta product_id, user_id y question, devuelve la fila creada", async () => {
    const created = { id: "q1", product_id: "p1", user_id: "u1", question: "¿Trae cargador?" };
    const supabase = mockSupabase({ questions: { single: created } });

    const question = await create("p1", "u1", "¿Trae cargador?", supabase);

    expect(question).toEqual(created);
    expect(supabase.inserts("questions")).toContainEqual({
      product_id: "p1",
      user_id: "u1",
      question: "¿Trae cargador?",
    });
  });
});

describe("question.service.answer", () => {
  it("actualiza answer y answered_at, filtrando por id, devuelve la fila actualizada", async () => {
    const answered = { id: "q1", answer: "Sí, incluye cargador.", answered_at: "2026-08-28T00:00:00.000Z" };
    const supabase = mockSupabase({ questions: { single: answered } });

    const result = await answer("q1", "Sí, incluye cargador.", supabase);

    expect(result).toEqual(answered);
    const call = supabase.calls.find((c) => c.table === "questions" && c.op === "update");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["id", "q1"] });
    const payload = call?.payload as { answer: string; answered_at: string };
    expect(payload.answer).toBe("Sí, incluye cargador.");
    expect(typeof payload.answered_at).toBe("string");
  });

  it("propaga el error tal cual (ej. GRANT de columna rechaza tocar 'question')", async () => {
    const supabase = mockSupabase({
      questions: { error: { message: "permission denied for column question" } },
    });
    await expect(answer("q1", "resp", supabase)).rejects.toMatchObject({
      message: "permission denied for column question",
    });
  });
});
