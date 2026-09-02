"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as sellerService from "@/services/seller.service";
import * as questionService from "@/services/question.service";
import type { PendingQuestion } from "@/types/question";

// Fase 7.5: preguntas sin responder de TODOS los productos del vendedor,
// en un solo lugar (antes solo se podía responder entrando a la página
// pública de cada producto). Optimista: la pregunta desaparece de la
// lista apenas se responde (ya no está "pendiente"), con rollback si
// falla — mismo patrón que useAdminUsers.changeRole/useSellerOrders.move.
export function useSellerQuestions(sellerId?: string) {
  const [questions, setQuestions] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(() => {
    if (!sellerId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    sellerService
      .listMyPendingQuestions(sellerId)
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [sellerId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const answer = useCallback(
    async (questionId: string, answerText: string) => {
      const previous = questions;
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      try {
        await questionService.answer(questionId, answerText);
      } catch (err) {
        setQuestions(previous);
        toast.error((err as Error).message);
      }
    },
    [questions],
  );

  return { questions, loading, error, answer, retry: fetchQuestions };
}
