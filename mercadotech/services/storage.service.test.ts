import { describe, it, expect } from "vitest";
import {
  getPublicUrl,
  uploadProductImage,
  deleteProductImage,
  saveImageOrder,
} from "@/services/storage.service";
import { mockSupabase } from "@/services/test-utils/supabase-mock";

describe("storage.service.getPublicUrl", () => {
  it("path ya bien formado (sin el nombre del bucket al frente): se usa tal cual", () => {
    const supabase = mockSupabase({});
    const url = getPublicUrl("product-images", "s1/p1/0.jpg", supabase);
    expect(url).toBe("https://fake.supabase.local/storage/v1/object/public/product-images/s1/p1/0.jpg");
  });

  it("bug real del seed.sql (Fase 2.5): un path que trae el bucket duplicado al frente se sanea", () => {
    const supabase = mockSupabase({});
    const url = getPublicUrl("product-images", "product-images/s1/p1/0.jpg", supabase);
    expect(url).toBe("https://fake.supabase.local/storage/v1/object/public/product-images/s1/p1/0.jpg");
  });
});

describe("storage.service.uploadProductImage", () => {
  it("arma el path sellerId/productId/n.ext, tomando la extensión del MIME real (no del nombre)", async () => {
    const supabase = mockSupabase({});
    const file = { type: "image/png" } as unknown as File;

    const path = await uploadProductImage(file, "s1", "p1", 2, supabase);

    expect(path).toBe("s1/p1/2.png");
    expect(supabase.storageCalls).toContainEqual({
      bucket: "product-images",
      op: "upload",
      args: ["s1/p1/2.png", file, { upsert: true }],
    });
  });

  it("MIME desconocido: cae a extensión jpg por defecto", async () => {
    const supabase = mockSupabase({});
    const file = { type: "image/gif" } as unknown as File;
    const path = await uploadProductImage(file, "s1", "p1", 0, supabase);
    expect(path).toBe("s1/p1/0.jpg");
  });

  it("propaga el error de Storage tal cual", async () => {
    const supabase = mockSupabase({}, { storage: { "product-images": { upload: { error: { message: "quota exceeded" } } } } });
    const file = { type: "image/jpeg" } as unknown as File;
    await expect(uploadProductImage(file, "s1", "p1", 0, supabase)).rejects.toMatchObject({
      message: "quota exceeded",
    });
  });
});

describe("storage.service.deleteProductImage", () => {
  it("borra el objeto de Storage y la fila de product_images por image_path", async () => {
    const supabase = mockSupabase({ product_images: {} });

    await deleteProductImage("s1/p1/0.jpg", supabase);

    expect(supabase.storageCalls).toContainEqual({
      bucket: "product-images",
      op: "remove",
      args: [["s1/p1/0.jpg"]],
    });
    const call = supabase.calls.find((c) => c.table === "product_images" && c.op === "delete");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["image_path", "s1/p1/0.jpg"] });
  });

  it("normaliza el prefijo 'product-images/' antes de pedirle a Storage que borre, pero NO al filtrar en la base (usa el image_path original completo)", async () => {
    const supabase = mockSupabase({ product_images: {} });

    await deleteProductImage("product-images/s1/p1/0.jpg", supabase);

    expect(supabase.storageCalls).toContainEqual({
      bucket: "product-images",
      op: "remove",
      args: [["s1/p1/0.jpg"]],
    });
    const call = supabase.calls.find((c) => c.table === "product_images" && c.op === "delete");
    expect(call?.chain).toContainEqual({ method: "eq", args: ["image_path", "product-images/s1/p1/0.jpg"] });
  });

  it("propaga el error de Storage tal cual, sin siquiera intentar borrar la fila", async () => {
    const supabase = mockSupabase(
      { product_images: {} },
      { storage: { "product-images": { remove: { error: { message: "not found" } } } } },
    );
    await expect(deleteProductImage("s1/p1/0.jpg", supabase)).rejects.toMatchObject({
      message: "not found",
    });
    expect(supabase.calls.some((c) => c.table === "product_images")).toBe(false);
  });
});

describe("storage.service.saveImageOrder", () => {
  it("arreglo vacío: no llama a upsert", async () => {
    const supabase = mockSupabase({ product_images: {} });
    await saveImageOrder([], supabase);
    expect(supabase.calls).toHaveLength(0);
  });

  it("hace upsert con las filas completas", async () => {
    const supabase = mockSupabase({ product_images: {} });
    const items = [{ id: "i1", product_id: "p1", image_path: "s1/p1/0.jpg", position: 0 }];

    await saveImageOrder(items, supabase);

    // El payload de .upsert(items) es el arreglo COMPLETO en una sola
    // llamada, no una llamada por fila — por eso se compara contra el
    // arreglo entero, no contra items[0].
    expect(supabase.upserts("product_images")).toContainEqual(items);
  });

  it("propaga el error tal cual", async () => {
    const supabase = mockSupabase({ product_images: { error: { message: "not null violation" } } });
    await expect(
      saveImageOrder([{ id: "i1", product_id: "p1", image_path: "x.jpg", position: 0 }], supabase),
    ).rejects.toMatchObject({ message: "not null violation" });
  });
});
