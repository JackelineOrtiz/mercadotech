"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useSellerQuestions } from "@/hooks/useSellerQuestions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import type { PendingQuestion } from "@/types/question";

// Fase 7.5, hallazgo real: antes de esta página, la ÚNICA forma de
// responder una pregunta era entrar a la página pública de CADA producto
// y buscarla ahí — sin ningún lugar en el panel que las juntara. Reusa
// question.service.answer (vía useSellerQuestions), sin lógica nueva de
// negocio: esta página es puro consumo de lo que ya existía.
export default function VendedorPreguntasPage() {
  const { profile } = useAuth();
  const { questions, loading, error, answer, retry } = useSellerQuestions(profile?.id);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (questions.length === 0) {
    return (
      <EmptyState
        title="No tienes preguntas pendientes"
        description="Las preguntas nuevas de tus productos van a aparecer acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Preguntas</h1>
      <ul className="flex flex-col gap-4">
        {questions.map((question) => (
          <QuestionCard key={question.id} question={question} onAnswer={answer} />
        ))}
      </ul>
    </div>
  );
}

function QuestionCard({
  question,
  onAnswer,
}: {
  question: PendingQuestion;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onAnswer(question.id, trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <Link
        href={`/producto/${question.product_id}`}
        className="w-fit text-sm font-medium text-primary hover:underline"
      >
        {question.productTitle}
      </Link>
      <p className="text-sm">
        <span className="font-medium">Usuario:</span> {question.question}
      </p>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Responde esta pregunta…"
          rows={2}
          className="flex-1"
        />
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !draft.trim()}>
          Responder
        </Button>
      </div>
    </li>
  );
}
