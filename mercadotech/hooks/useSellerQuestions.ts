"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as sellerService from "@/services/seller.service";
import * as questionService from "@/services/question.service";
import type { SellerQuestion } from "@/types/question";

// Fase 7.5: TODAS las preguntas (pendientes y respondidas) de todos los
// productos del vendedor, en un solo lugar (antes solo se podía responder
// entrando a la página pública de cada producto). Optimista: al responder,
// la pregunta se ACTUALIZA en el lugar (answer/answered_at), nunca se
// quita de la lista — hallazgo real #2 (mismo smoke test que el #1): la
// primera versión de este hook la sacaba de `questions` al responder, y
// como el service de entonces solo traía las sin responder, la pregunta
// desaparecía sin dejar rastro de lo que se había contestado. Con rollback
// si falla — mismo patrón que useAdminUsers.changeRole/useSellerOrders.move.
export function useSellerQuestions(sellerId?: string) {
  const [questions, setQuestions] = useState<SellerQuestion[]>([]);
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
      .listMyQuestions(sellerId)
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
      const answeredAt = new Date().toISOString();
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, answer: answerText, answered_at: answeredAt } : q)),
      );
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
