"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Question } from "@/types/question";

export interface QuestionsSectionProps {
  questions: Question[];
  hasSession: boolean;
  isOwner: boolean;
  loading: boolean;
  onAsk: (question: string) => Promise<void>;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onRequireLogin: () => void;
}

export function QuestionsSection({
  questions,
  hasSession,
  isOwner,
  loading,
  onAsk,
  onAnswer,
  onRequireLogin,
}: QuestionsSectionProps) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAsk() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onAsk(trimmed);
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Preguntas y respuestas</h2>

      {hasSession ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe tu pregunta…"
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleAsk} disabled={submitting || !draft.trim()}>
            Preguntar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={onRequireLogin} className="self-start">
          Inicia sesión para preguntar
        </Button>
      )}

      {loading ? null : questions.length === 0 ? (
        <EmptyState title="Todavía no hay preguntas" description="Sé el primero en preguntar." />
      ) : (
        <ul className="flex flex-col gap-4">
          {questions.map((question) => (
            <QuestionItem
              key={question.id}
              question={question}
              isOwner={isOwner}
              onAnswer={onAnswer}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionItem({
  question,
  isOwner,
  onAnswer,
}: {
  question: Question;
  isOwner: boolean;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Sin nombre de autor: profiles solo es legible por su dueño o un admin
  // (RLS de la Fase 2.3) — mostrar el nombre real requeriría una vista
  // public_profiles, fuera de alcance de esta sesión.
  const canAnswerInline = isOwner && !question.answer;

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
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0">
      <p className="text-sm">
        <span className="font-medium">Usuario:</span> {question.question}
      </p>
      {question.answer ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Vendedor:</span> {question.answer}
        </p>
      ) : canAnswerInline ? (
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
      ) : (
        <p className="text-sm italic text-muted-foreground">Sin responder todavía.</p>
      )}
    </li>
  );
}
