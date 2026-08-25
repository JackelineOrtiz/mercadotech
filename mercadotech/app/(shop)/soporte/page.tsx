"use client";

import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useMyTickets } from "@/hooks/useMyTickets";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABELS } from "@/lib/constants/tickets";

export default function SoportePage() {
  const { user, initializing } = useAuth();
  const { messages, sendMessage, loading } = useChat("soporte");
  const { tickets, loading: ticketsLoading, error: ticketsError } = useMyTickets(user?.id);

  if (initializing) return <LoadingState rows={4} />;
  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Soporte</h1>
        <p className="text-sm text-muted-foreground">
          Pregunta sobre envíos, pagos, devoluciones o tu cuenta.
        </p>
        {/* Espacio reservado para el botón de micrófono de la Sesión 8
            (agente de voz): este chat se AMPLÍA ahí, no se reemplaza —
            dejar este comentario para esa fase. */}
      </div>

      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={sendMessage}
        emptyState={
          <p className="text-sm text-muted-foreground">Escribe tu pregunta para empezar.</p>
        }
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mis tickets</h2>
        {ticketsLoading ? (
          <LoadingState rows={2} />
        ) : ticketsError ? (
          <p className="text-sm text-destructive">{ticketsError}</p>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tienes tickets abiertos"
            description="Si el chat no resuelve tu duda, te sugerirá crear uno."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString("es-PE")}
                  </p>
                </div>
                <Badge variant={TICKET_STATUS_BADGE_VARIANT[ticket.status]}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
