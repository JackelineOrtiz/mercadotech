"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface SearchBarProps {
  defaultValue?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

// Solo navega a /buscar?q= — la pestaña "Coincidencia exacta" vs
// "Resultados con IA" (Fase 4.4) vive en la propia página de resultados,
// no aquí.
export function SearchBar({ defaultValue = "", onSearch, className }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    onSearch?.(trimmed);
    router.push(trimmed ? `/buscar?q=${encodeURIComponent(trimmed)}` : "/buscar");
  }

  // Hallazgo real (Fase 7.5): el <input type="search"> nativo trae su
  // propia "x" en algunos navegadores (Chrome/Safari), pero no en todos
  // (Firefox nunca la muestra) y el estilo de Input la pisa igual —
  // resultado observable: ningún navegador la mostraba de forma
  // consistente. Botón propio, solo visible con texto escrito; limpia el
  // campo y devuelve el foco para escribir la próxima búsqueda, sin
  // navegar (limpiar el input no implica descartar los resultados que ya
  // se están viendo).
  function handleClear() {
    setQuery("");
    onSearch?.("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar laptops, componentes, marcas…"
          aria-label="Buscar productos"
          className="px-9"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Button type="submit" className="sr-only">
        Buscar
      </Button>
    </form>
  );
}
