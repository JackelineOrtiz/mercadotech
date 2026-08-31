"use client";

import { useRef } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GalleryImageValue {
  id: string;
  url: string;
}

export interface SortableImageGalleryProps {
  images: GalleryImageValue[];
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onAddFiles: (files: File[]) => void;
  disabled?: boolean;
}

function Thumbnail({
  image,
  index,
  total,
  isCover,
  onRemove,
  disabled,
}: {
  image: GalleryImageValue;
  index: number;
  total: number;
  isCover: boolean;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // El nombre accesible vive en el contenedor arrastrable (lo que un
  // lector de pantalla anuncia al enfocarlo con Tab), no en la imagen: el
  // <Image> de adentro es decorativo respecto a ese nombre, por eso
  // alt="" — mismo patrón que los thumbnails de ProductGallery (3.5).
  const label = `Imagen ${index + 1} de ${total}${isCover ? " (portada)" : ""}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={label}
      className={cn(
        "relative size-24 shrink-0 touch-none overflow-hidden rounded-md border border-border",
        !disabled && "cursor-grab",
        isDragging && "opacity-50",
      )}
    >
      <Image src={image.url} alt="" fill sizes="96px" className="object-cover" />
      {isCover ? (
        <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          Portada
        </span>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        size="icon-xs"
        className="absolute top-1 right-1"
        aria-label="Quitar imagen"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X />
      </Button>
    </div>
  );
}

export function SortableImageGallery({
  images,
  onReorder,
  onRemove,
  onAddFiles,
  disabled,
}: SortableImageGalleryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
          <div
            className="flex flex-wrap gap-2"
            role="list"
            aria-label="Galería de imágenes, arrastra para reordenar"
          >
            {images.map((image, index) => (
              <Thumbnail
                key={image.id}
                image={image}
                index={index}
                total={images.length}
                isCover={index === 0}
                onRemove={() => onRemove(image.id)}
                disabled={disabled}
              />
            ))}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex size-24 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-5" aria-hidden="true" />
              Agregar
            </button>
          </div>
        </SortableContext>
      </DndContext>
      <input
        ref={inputRef}
        type="file"
        data-testid="product-form-images-input"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label="Subir imágenes"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onAddFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
