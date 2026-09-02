"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";
import { SORT_OPTIONS, type SortOption } from "@/lib/constants/catalog";

export interface FiltersValue {
  condition: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
}

export interface FiltersPanelProps {
  value: FiltersValue;
  onChange: (patch: Partial<FiltersValue>) => void;
}

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

function FiltersBody({ value, onChange }: FiltersPanelProps) {
  function toggleCondition(condition: ProductCondition) {
    const next = value.condition.includes(condition)
      ? value.condition.filter((c) => c !== condition)
      : [...value.condition, condition];
    onChange({ condition: next });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Orden</Label>
        <Select
          value={value.sort}
          onValueChange={(next) => onChange({ sort: next as SortOption })}
        >
          <SelectTrigger>
            {/* Base UI Select.Value no auto-resuelve el label de un
                SelectItem como Radix: sin "children" como función muestra
                el value crudo en el primer render y puede resolverlo de
                otra forma después de montar — eso causaba un mismatch de
                hidratación (server: "recientes", client: label real). */}
            <SelectValue>
              {(v: SortOption | null) =>
                SORT_OPTIONS.find((option) => option.value === v)?.label ?? "Ordenar"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm leading-none font-medium">Condición</legend>
        {PRODUCT_CONDITIONS.map((condition) => (
          <label key={condition} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.condition.includes(condition)}
              onChange={() => toggleCondition(condition)}
              className="size-4 rounded border-input accent-primary"
            />
            {CONDITION_LABELS[condition]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label>Precio ($)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Mín"
            aria-label="Precio mínimo"
            value={value.minPrice ?? ""}
            onChange={(e) =>
              onChange({ minPrice: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Máx"
            aria-label="Precio máximo"
            value={value.maxPrice ?? ""}
            onChange={(e) =>
              onChange({ maxPrice: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}

export function FiltersPanel(props: FiltersPanelProps) {
  return (
    <>
      <aside className="hidden w-56 shrink-0 md:block">
        <FiltersBody {...props} />
      </aside>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filtros
              </Button>
            }
          />
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <FiltersBody {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
