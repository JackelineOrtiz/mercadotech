"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// next-themes ya era dependencia (instalado junto a sonner en el Prompt 0);
// attribute="class" es lo que espera globals.css: @custom-variant dark
// (&:is(.dark *)). El Toaster de sonner necesita este provider para saber
// qué tema mostrar — sin él, useTheme() dentro de components/ui/sonner.tsx
// no tiene de dónde leer.
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
