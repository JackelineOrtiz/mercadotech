"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as sellerService from "@/services/seller.service";
import * as storageService from "@/services/storage.service";
import type { ImageOrderItem } from "@/services/storage.service";
import { getProductById, getProductImages } from "@/services/product.service";
import { triggerReindex } from "@/services/indexing-trigger.service";
import { validateProduct, type FieldErrors } from "@/lib/validators/product";
import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/constants/product";
import type { ProductCondition } from "@/lib/constants/roles";

export interface ProductFormValues {
  categoryId: string;
  title: string;
  description: string;
  brand: string;
  condition: ProductCondition;
  price: string;
  stock: string;
}

// El id SIEMPRE existe desde el momento en que la imagen entra al arreglo
// (crypto.randomUUID() generado localmente, aunque el producto ni siquiera
// exista todavía en modo create) — es también el id que terminará teniendo
// la fila de product_images, así que no hace falta reconciliar dos ids
// distintos en ningún punto del flujo.
export interface GalleryImage {
  id: string;
  url: string;
  persisted: boolean;
  imagePath?: string;
  file?: File;
}

const EMPTY_VALUES: ProductFormValues = {
  categoryId: "",
  title: "",
  description: "",
  brand: "",
  condition: "nuevo",
  price: "",
  stock: "0",
};

// El path de Storage es {seller_id}/{product_id}/{n}.{ext} — n es un
// contador de nombre de archivo independiente de "position" (el orden
// visual, que sí se recalcula completo en cada mutación). Sin esta
// separación, subir una imagen nueva después de reordenar/borrar podría
// reutilizar un nombre de archivo ya usado y pisar un objeto existente en
// Storage. Se recupera parseando el path, no hay contador en la BD.
function extractFileNumber(imagePath: string): number {
  const match = imagePath.match(/\/(\d+)\.\w+$/);
  return match ? Number(match[1]) : 0;
}

// RAZONAMIENTO (ciclo de vida de una imagen):
// - CREATE: el path de Storage exige product_id, que no existe hasta el
//   submit (decisión 12). Toda imagen agregada antes de eso vive SOLO en
//   memoria: File + URL.createObjectURL para la miniatura, persisted:false.
//   Reordenar/quitar son operaciones puramente locales (setImages), sin
//   llamadas a Supabase. Recién en submit(): createProduct → sube cada
//   File en el orden final (n = índice+1) → un solo saveImageOrder con las
//   product_images completas (position = índice).
// - EDIT: las imágenes ya existen (persisted:true, con imagePath e id
//   reales). Cada mutación se persiste AL INSTANTE: agregar sube el
//   archivo y hace saveImageOrder de esa fila; reordenar hace
//   saveImageOrder de todas las filas con su nueva position; quitar borra
//   en Storage y en la tabla (deleteProductImage). Nunca queda una imagen
//   "local no guardada" en este modo.
export function useProductForm(sellerId?: string, productId?: string) {
  const mode: "create" | "edit" = productId ? "edit" : "create";
  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !productId || !sellerId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getProductById(productId), getProductImages(productId)])
      .then(([product, productImages]) => {
        if (cancelled) return;
        // products_select_active_or_own deja leer CUALQUIER producto
        // activo, no solo los propios — sin este chequeo, seller2 podría
        // abrir la URL de edición de un producto activo de seller1 y ver
        // sus datos en el formulario (la escritura sí la bloquea RLS, pero
        // la lectura no). Defensa en profundidad en el cliente.
        if (product.seller_id !== sellerId) {
          setLoadError("No tienes acceso a este producto.");
          setLoading(false);
          return;
        }
        setValues({
          categoryId: product.category_id,
          title: product.title,
          description: product.description ?? "",
          brand: product.brand ?? "",
          condition: product.condition,
          price: String(product.price),
          stock: String(product.stock),
        });
        setImages(
          [...productImages]
            .sort((a, b) => a.position - b.position)
            .map((img) => ({
              id: img.id,
              url: img.image_url,
              persisted: true,
              imagePath: img.image_path,
            })),
        );
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError((err as Error).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, productId, sellerId]);

  const setField = useCallback(
    <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const addImages = useCallback(
    async (files: File[]) => {
      const accepted: File[] = [];
      for (const file of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
          toast.error(`${file.name}: tipo no permitido (solo JPEG, PNG o WEBP).`);
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          toast.error(`${file.name}: supera los 5 MB.`);
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length === 0) return;

      const availableSlots = Math.max(0, MAX_IMAGES_PER_PRODUCT - images.length);
      if (accepted.length > availableSlots) {
        toast.error(`Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto.`);
      }
      const toAdd = accepted.slice(0, availableSlots);
      if (toAdd.length === 0) return;

      if (mode === "create") {
        setImages((prev) => [
          ...prev,
          ...toAdd.map((file) => ({
            id: crypto.randomUUID(),
            url: URL.createObjectURL(file),
            persisted: false,
            file,
          })),
        ]);
        return;
      }

      for (const file of toAdd) {
        const maxN = images.reduce(
          (max, img) => Math.max(max, img.imagePath ? extractFileNumber(img.imagePath) : 0),
          0,
        );
        try {
          const path = await storageService.uploadProductImage(
            file,
            sellerId!,
            productId!,
            maxN + 1,
          );
          const id = crypto.randomUUID();
          const item: ImageOrderItem = {
            id,
            product_id: productId!,
            image_path: path,
            position: images.length,
          };
          await storageService.saveImageOrder([item]);
          setImages((prev) => [
            ...prev,
            {
              id,
              url: storageService.getPublicUrl("product-images", path),
              persisted: true,
              imagePath: path,
            },
          ]);
        } catch (err) {
          toast.error((err as Error).message);
        }
      }
    },
    [images, mode, sellerId, productId],
  );

  const removeImage = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id);
      if (!image) return;

      if (!image.persisted) {
        URL.revokeObjectURL(image.url);
        setImages((prev) => prev.filter((img) => img.id !== id));
        return;
      }

      const previous = images;
      setImages((prev) => prev.filter((img) => img.id !== id));
      try {
        await storageService.deleteProductImage(image.imagePath!);
      } catch (err) {
        setImages(previous);
        toast.error((err as Error).message);
      }
    },
    [images],
  );

  const reorder = useCallback(
    (fromId: string, toId: string) => {
      setImages((prev) => {
        const fromIndex = prev.findIndex((img) => img.id === fromId);
        const toIndex = prev.findIndex((img) => img.id === toId);
        if (fromIndex === -1 || toIndex === -1) return prev;

        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        if (mode === "edit") {
          const items: ImageOrderItem[] = next
            .filter((img): img is GalleryImage & { imagePath: string } => img.persisted)
            .map((img, index) => ({
              id: img.id,
              product_id: productId!,
              image_path: img.imagePath,
              position: index,
            }));
          storageService
            .saveImageOrder(items)
            .catch((err) => toast.error((err as Error).message));
        }

        return next;
      });
    },
    [mode, productId],
  );

  const submit = useCallback(async () => {
    const price = Number(values.price);
    const stock = Number(values.stock);
    const validationErrors = validateProduct({
      title: values.title,
      price,
      stock,
      categoryId: values.categoryId,
      imageCount: images.length,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      throw new Error("Revisa los campos del formulario.");
    }

    setSubmitting(true);
    try {
      const input = {
        categoryId: values.categoryId,
        title: values.title,
        description: values.description,
        brand: values.brand,
        condition: values.condition,
        price,
        stock,
      };

      if (mode === "create") {
        const newProductId = await sellerService.createProduct(sellerId!, input);
        const items: ImageOrderItem[] = [];
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const path = await storageService.uploadProductImage(
            img.file!,
            sellerId!,
            newProductId,
            i + 1,
          );
          items.push({ id: img.id, product_id: newProductId, image_path: path, position: i });
        }
        await storageService.saveImageOrder(items);
        // Fire-and-forget (Fase 4.3): la ficha de búsqueda semántica se
        // arma sola, sin retrasar ni poder romper la publicación.
        triggerReindex("producto", newProductId);
        return newProductId;
      }

      await sellerService.updateProduct(productId!, input);
      triggerReindex("producto", productId!);
      return productId!;
    } finally {
      setSubmitting(false);
    }
  }, [values, images, mode, sellerId, productId]);

  return {
    mode,
    values,
    setField,
    images,
    addImages,
    removeImage,
    reorder,
    errors,
    loading,
    loadError,
    submitting,
    submit,
  };
}
