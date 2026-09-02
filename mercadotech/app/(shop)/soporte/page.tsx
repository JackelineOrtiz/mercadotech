"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { useMyTickets } from "@/hooks/useMyTickets";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { LoadingState } from "@/components/shared/LoadingState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TICKET_STATUS_BADGE_VARIANT, TICKET_STATUS_LABELS } from "@/lib/constants/tickets";
// Fase 7.2 (performance): mismo componente que /asistente — dynamic
// import probado y REVERTIDO, ver ese comentario y docs/PERFORMANCE.md
// (308 kB → 312 kB, peor, no mejor).

export default function SoportePage() {
  const { user, initializing } = useAuth();
  const { messages, sendMessage, loading } = useChat("soporte");
  const { tickets, loading: ticketsLoading, error: ticketsError, creating, create } =
    useMyTickets(user?.id);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    try {
      await create(subject.trim(), message.trim());
      toast.success("Ticket creado.");
      setOpen(false);
      setSubject("");
      setMessage("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mis tickets</h2>
          {/* Hallazgo real (Fase 7.5): el chat sugiere "abrir un ticket"
              pero no existía ninguna forma de crear uno desde la UI — solo
              lectura, decisión 5 de la spec la había pospuesto a la Sesión
              8 (agente de voz); pedido explícito del usuario de
              construirlo ahora igual. */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button size="sm" data-testid="ticket-create-open">
                  Nuevo ticket
                </Button>
              }
            />
            <DialogContent>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>Nuevo ticket</DialogTitle>
                  <DialogDescription>
                    Un agente humano revisará tu caso. Usa esto si el chat no resolvió tu duda.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticket-subject">Asunto</Label>
                  <Input
                    id="ticket-subject"
                    data-testid="ticket-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ticket-message">Mensaje</Label>
                  <Textarea
                    id="ticket-message"
                    data-testid="ticket-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" data-testid="ticket-create-submit" disabled={creating}>
                    {creating ? "Creando…" : "Crear ticket"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {ticketsLoading ? (
          <LoadingState rows={2} />
        ) : ticketsError ? (
          <p className="text-sm text-destructive">{ticketsError}</p>
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tienes tickets abiertos"
            description="Si el chat no resuelve tu duda, creá uno con el botón de arriba."
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
                    {new Date(ticket.created_at).toLocaleDateString("es-CO")}
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
