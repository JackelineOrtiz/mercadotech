"use client";

import { useCallback, useEffect, useState } from "react";
import { listMine, createTicket } from "@/services/ticket.service";
import type { Ticket } from "@/types/ticket";

export function useMyTickets(userId?: string) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(() => {
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    listMine(userId)
      .then((data) => {
        setTickets(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Sin optimismo local (a diferencia de useAdminUsers.changeRole o
  // useSellerOrders.move): un ticket recién creado necesita su propia fila
  // real (id generado por Postgres) antes de poder mostrarse — no hay un
  // valor local razonable para "optimizar" antes de esa respuesta, así
  // que se refresca la lista completa después de crear, igual que
  // fetchTickets ya hace en cualquier otro caso.
  const create = useCallback(
    async (subject: string, message: string) => {
      if (!userId) return;
      setCreating(true);
      try {
        await createTicket(userId, subject, message);
        fetchTickets();
      } finally {
        setCreating(false);
      }
    },
    [userId, fetchTickets],
  );

  return { tickets, loading, error, creating, create, retry: fetchTickets };
}
