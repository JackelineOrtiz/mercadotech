"use client";

import { useCallback, useEffect, useState } from "react";
import { listMine } from "@/services/ticket.service";
import type { Ticket } from "@/types/ticket";

export function useMyTickets(userId?: string) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return { tickets, loading, error, retry: fetchTickets };
}
