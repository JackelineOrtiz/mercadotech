"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSellerQuestions } from "@/hooks/useSellerQuestions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductPreviewDialog } from "@/components/product/ProductPreviewDialog";
import type { SellerQuestion } from "@/types/question";

// Fase 7.5, hallazgo real: antes de esta página, la ÚNICA forma de
// responder una pregunta era entrar a la página pública de CADA producto
// y buscarla ahí — sin ningún lugar en el panel que las juntara. Reusa
// question.service.answer (vía useSellerQuestions), sin lógica nueva de
// negocio: esta página es puro consumo de lo que ya existía.
//
// Hallazgo real #2 (mismo smoke test, después de que #1 ya estaba
// resuelto): el vendedor respondía una pregunta y esta desaparecía de la
// pantalla sin dejar rastro — useSellerQuestions solo traía las
// pendientes. Ahora trae todas y esta página las separa en dos secciones:
// "Pendientes" (editable, igual que antes) y "Respondidas" (solo lectura,
// para poder repasar lo que ya se contestó).
export default function VendedorPreguntasPage() {
  const { profile } = useAuth();
  const { questions, loading, error, answer, retry } = useSellerQuestions(profile?.id);
  // Un solo id "en previsualización" para toda la página — nunca más de
  // un diálogo abierto a la vez, así que un solo <ProductPreviewDialog>
  // al final alcanza en vez de uno por tarjeta.
  const [previewId, setPreviewId] = useState<string | null>(null);

  const pending = useMemo(() => questions.filter((q) => q.answer === null), [questions]);
  const answered = useMemo(() => questions.filter((q) => q.answer !== null), [questions]);

  if (loading) return <LoadingState rows={4} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (questions.length === 0) {
    return (
      <EmptyState
        title="Todavía no te han hecho preguntas"
        description="Las preguntas nuevas de tus productos van a aparecer acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Preguntas</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Pendientes ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tienes preguntas pendientes.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((question) => (
              <PendingQuestionCard
                key={question.id}
                question={question}
                onAnswer={answer}
                onPreview={() => setPreviewId(question.product_id)}
              />
            ))}
          </ul>
        )}
      </section>

      {answered.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Respondidas ({answered.length})</h2>
          <ul className="flex flex-col gap-4">
            {answered.map((question) => (
              <AnsweredQuestionCard
                key={question.id}
                question={question}
                onPreview={() => setPreviewId(question.product_id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <ProductPreviewDialog
        productId={previewId}
        onOpenChange={(open) => !open && setPreviewId(null)}
      />
    </div>
  );
}

// Botón que abre la previsualización, compartido entre tarjeta pendiente
// y respondida — mismo hallazgo real que ya resolvió esta pantalla antes:
// un <Link> a la ficha pública sacaba al vendedor a una pantalla con "Es
// tu propio producto" y acciones de comprador deshabilitadas.
function ProductTitleButton({ title, onPreview }: { title: string; onPreview: () => void }) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className="w-fit text-sm font-medium text-primary hover:underline"
    >
      {title}
    </button>
  );
}

function PendingQuestionCard({
  question,
  onAnswer,
  onPreview,
}: {
  question: SellerQuestion;
  onAnswer: (questionId: string, answer: string) => Promise<void>;
  onPreview: () => void;
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
      <ProductTitleButton title={question.productTitle} onPreview={onPreview} />
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

// Solo lectura: la pregunta ya tiene respuesta, no hace falta ningún
// formulario — solo un lugar para repasar lo que se contestó.
function AnsweredQuestionCard({
  question,
  onPreview,
}: {
  question: SellerQuestion;
  onPreview: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <ProductTitleButton title={question.productTitle} onPreview={onPreview} />
        <Badge variant="secondary">Respondida</Badge>
      </div>
      <p className="text-sm">
        <span className="font-medium">Usuario:</span> {question.question}
      </p>
      <p className="text-sm">
        <span className="font-medium">Tu respuesta:</span> {question.answer}
      </p>
    </li>
  );
}
