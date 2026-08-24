"use client";

import { useCallback, useEffect, useState } from "react";
import * as questionService from "@/services/question.service";
import type { Question } from "@/types/question";

export function useQuestions(productId: string) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    setError(null);
    questionService
      .listByProduct(productId)
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [productId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const ask = useCallback(
    async (userId: string, question: string) => {
      const created = await questionService.create(productId, userId, question);
      setQuestions((prev) => [created, ...prev]);
    },
    [productId],
  );

  // Optimista: refleja la respuesta de inmediato; si el service falla (ej.
  // RLS rechaza porque ya no es el dueño del producto), revierte recargando
  // desde el servidor.
  const answer = useCallback(
    async (questionId: string, answerText: string) => {
      const previous = questions;
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, answer: answerText, answered_at: new Date().toISOString() }
            : q,
        ),
      );
      try {
        await questionService.answer(questionId, answerText);
      } catch (err) {
        setQuestions(previous);
        throw err;
      }
    },
    [questions],
  );

  return { questions, loading, error, ask, answer, retry: fetchQuestions };
}
