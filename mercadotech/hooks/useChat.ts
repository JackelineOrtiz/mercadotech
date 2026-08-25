"use client";

import { useCallback, useState } from "react";
import type { ChatMessage, ChatMode, ChatResult } from "@/types/chat";

// Historial SOLO en memoria (se pierde al recargar — fuera de alcance de
// la sesión persistirlo). Parametrizado por modo: /asistente usa 'compras',
// /soporte usa 'soporte' — cada instancia del hook es una conversación
// independiente.
export function useChat(mode: ChatMode) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch("/api/v1/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, mode }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message ?? "No se pudo procesar la consulta.");
        }
        const result = json as ChatResult;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.answer, sources: result.sources },
        ]);
      } catch {
        // La conversación NUNCA se rompe: un fallo del servidor (token
        // caído, modelo rotado, red) se convierte en un mensaje más del
        // asistente, no en una pantalla de error que corta el chat.
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No pude procesar tu consulta. Intenta de nuevo en unos segundos." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [mode, loading],
  );

  return { messages, sendMessage, loading };
}
