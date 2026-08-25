"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useProductForm } from "@/hooks/useProductForm";
import { ProductForm } from "@/components/seller/ProductForm";
import { LoadingState } from "@/components/shared/LoadingState";

const VALIDATION_ERROR_MESSAGE = "Revisa los campos del formulario.";

export default function VendedorPublicarPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const form = useProductForm(profile?.id);

  async function handleSubmit() {
    try {
      const newProductId = await form.submit();
      toast.success("Producto publicado.");
      router.push(`/vendedor/productos/${newProductId}/editar`);
    } catch (err) {
      if ((err as Error).message !== VALIDATION_ERROR_MESSAGE) {
        toast.error((err as Error).message);
      }
    }
  }

  if (!profile || categoriesLoading) {
    return <LoadingState rows={4} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Publicar producto</h1>
      <ProductForm
        value={form.values}
        onChange={form.setField}
        images={form.images}
        onAddImages={form.addImages}
        onRemoveImage={form.removeImage}
        onReorderImages={form.reorder}
        categories={categories}
        errors={form.errors}
        submitting={form.submitting}
        onSubmit={handleSubmit}
        submitLabel="Publicar"
      />
    </div>
  );
}
