"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    onSearch?.(trimmed);
    router.push(trimmed ? `/buscar?q=${encodeURIComponent(trimmed)}` : "/buscar");
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar laptops, componentes, marcas…"
          aria-label="Buscar productos"
          className="pl-9"
        />
      </div>
      <Button type="submit" className="sr-only">
        Buscar
      </Button>
    </form>
  );
}
