"use client";

import { useCallback, useEffect, useState } from "react";
import * as questionService from "@/services/question.service";
import type { MyQuestion } from "@/types/question";

// Fase 7.5, hallazgo real: no había ningún lugar donde un comprador
// pudiera ver las preguntas que ÉL había hecho, a través de todos los
// productos — había que recordar en qué ficha se había preguntado y
// volver ahí para ver si ya tenía respuesta. Solo lectura (a diferencia
// de useSellerQuestions, acá no hay nada que "responder") — mismo patrón
// simple de useOrders.
export function useMyQuestions(userId?: string) {
  const [questions, setQuestions] = useState<MyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(() => {
    if (!userId) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    questionService
      .listByUser(userId)
      .then((data) => {
        setQuestions(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  return { questions, loading, error, retry: fetchQuestions };
}
