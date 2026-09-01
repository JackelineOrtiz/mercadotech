import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProductById } from "@/services/product.service";
import { ProductoPageClient } from "./ProductoPageClient";

// Server Component: solo resuelve el <title> de la pestaña, todo el resto
// de la pantalla sigue siendo 100% cliente (ProductoPageClient, sin
// cambios de lógica). getProductById ya es un service puro e inyectable
// (convención de la Sesión 3) — acá se lo llama con el cliente SERVIDOR
// (lib/supabase/server.ts, ya existía para el middleware/SSR) en vez del
// cliente de browser, así que sigue respetando las mismas políticas RLS
// (products_select_active_or_own): un producto inactivo ajeno da PGRST116
// acá igual que en el hook del cliente, y cae al catch de abajo.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const product = await getProductById(id, supabase);
    return {
      title: `${product.title} | MercadoTech`,
      description: product.description ?? undefined,
    };
  } catch {
    // Id con formato válido pero inexistente (PGRST116) o cualquier otro
    // error de red: no vale la pena romper el render por un título — cae
    // a un título genérico y ProductoPageClient ya maneja el EmptyState
    // real de "producto no encontrado" en el cuerpo de la página.
    return { title: "Producto no encontrado | MercadoTech" };
  }
}

export default function ProductoPage() {
  return <ProductoPageClient />;
}
