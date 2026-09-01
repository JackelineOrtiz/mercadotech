"use client";

import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { LoadingState } from "@/components/shared/LoadingState";
// Fase 7.2 (performance): se probó `dynamic import` acá (candidato
// preaprobado por la spec) y se REVIRTIÓ — medido en docs/PERFORMANCE.md:
// ChatWindow no tiene dependencia de terceros pesada, y el wrapper de
// `dynamic()` agregó más First Load JS del que ahorró (307 kB → 311 kB).
// Regla de la fase: sin mejora medible (acá, directamente peor), se
// revierte y queda anotado como intentado.

const SUGGESTIONS = [
  "¿qué laptop me recomiendas para diseño por menos de S/ 3,500?",
  "busco audífonos para hacer ejercicio",
  "necesito un mouse para gaming",
];

export default function AsistentePage() {
  const { user, initializing } = useAuth();
  const { messages, sendMessage, loading } = useChat("compras");

  if (initializing) return <LoadingState rows={4} />;
  // El middleware (lib/supabase/middleware.ts) ya redirige a un anónimo
  // antes de llegar aquí — esto cubre el instante entre montar y que
  // useAuth resuelva la sesión del lado del cliente.
  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Asesor de compras</h1>
        <p className="text-sm text-muted-foreground">
          Pregúntame qué buscas y te recomiendo productos reales del catálogo.
        </p>
      </div>

      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={sendMessage}
        emptyState={
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Prueba con:</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {suggestion}
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}
