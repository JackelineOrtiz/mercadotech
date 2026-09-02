import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableImageGallery, type GalleryImageValue } from "@/components/seller/SortableImageGallery";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";
import type { Category } from "@/types/product";
import type { FieldErrors } from "@/lib/validators/product";

export interface ProductFormValue {
  categoryId: string;
  title: string;
  description: string;
  brand: string;
  condition: ProductCondition;
  price: string;
  stock: string;
}

export interface ProductFormProps {
  value: ProductFormValue;
  onChange: <K extends keyof ProductFormValue>(field: K, value: ProductFormValue[K]) => void;
  images: GalleryImageValue[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages: (fromId: string, toId: string) => void;
  categories: Category[];
  errors: FieldErrors;
  submitting: boolean;
  onSubmit: () => void;
  submitLabel: string;
}

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

export function ProductForm({
  value,
  onChange,
  images,
  onAddImages,
  onRemoveImage,
  onReorderImages,
  categories,
  errors,
  submitting,
  onSubmit,
  submitLabel,
}: ProductFormProps) {
  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          data-testid="product-form-title"
          value={value.title}
          onChange={(e) => onChange("title", e.target.value)}
          aria-invalid={!!errors.title}
        />
        {errors.title ? <p className="text-sm text-destructive">{errors.title}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          data-testid="product-form-description"
          value={value.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            data-testid="product-form-brand"
            value={value.brand}
            onChange={(e) => onChange("brand", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Condición</Label>
          <Select
            value={value.condition}
            onValueChange={(v) => onChange("condition", v as ProductCondition)}
          >
            <SelectTrigger className="w-full" data-testid="product-form-condition">
              <SelectValue>
                {(v: ProductCondition | null) => (v ? CONDITION_LABELS[v] : "Elige")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CONDITION_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Precio ($)</Label>
          <Input
            id="price"
            data-testid="product-form-price"
            type="number"
            min={0}
            step="0.01"
            value={value.price}
            onChange={(e) => onChange("price", e.target.value)}
            aria-invalid={!!errors.price}
          />
          {errors.price ? <p className="text-sm text-destructive">{errors.price}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="stock">Existencias</Label>
          <Input
            id="stock"
            data-testid="product-form-stock"
            type="number"
            min={0}
            step="1"
            value={value.stock}
            onChange={(e) => onChange("stock", e.target.value)}
            aria-invalid={!!errors.stock}
          />
          {errors.stock ? <p className="text-sm text-destructive">{errors.stock}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Categoría</Label>
          <Select
            value={value.categoryId}
            onValueChange={(v) => onChange("categoryId", (v as string) ?? "")}
          >
            <SelectTrigger className="w-full" data-testid="product-form-category">
              <SelectValue>
                {(v: string | null) => categories.find((c) => c.id === v)?.name ?? "Elige"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId ? (
            <p className="text-sm text-destructive">{errors.categoryId}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Imágenes</Label>
        <SortableImageGallery
          images={images}
          onAddFiles={onAddImages}
          onRemove={onRemoveImage}
          onReorder={onReorderImages}
        />
        {errors.images ? <p className="text-sm text-destructive">{errors.images}</p> : null}
      </div>

      <Button
        type="submit"
        data-testid="product-form-submit"
        disabled={submitting}
        className="self-start"
      >
        {submitting ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}
