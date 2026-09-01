"use client";

import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useProductForm } from "@/hooks/useProductForm";
import { ProductForm } from "@/components/seller/ProductForm";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";

const VALIDATION_ERROR_MESSAGE = "Revisa los campos del formulario.";

export default function VendedorEditarProductoPage() {
  const params = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const form = useProductForm(profile?.id, params.id);

  async function handleSubmit() {
    try {
      await form.submit();
      toast.success("Cambios guardados.");
    } catch (err) {
      if ((err as Error).message !== VALIDATION_ERROR_MESSAGE) {
        toast.error((err as Error).message);
      }
    }
  }

  if (!profile || categoriesLoading || form.loading) {
    return <LoadingState rows={4} />;
  }

  // seller2 abriendo la URL de un producto de seller1: useProductForm ya
  // comparó seller_id contra el usuario logueado y puso loadError en vez
  // de poblar el formulario.
  if (form.loadError) {
    return <ErrorState onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Mis productos", href: "/vendedor/productos" },
          { label: form.values.title || "Editar producto" },
        ]}
      />
      <h1 className="text-2xl font-bold">Editar producto</h1>
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
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
