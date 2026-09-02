"use client";

import { useState } from "react";
import { RatingStars } from "@/components/shared/RatingStars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Review } from "@/types/review";

export interface ReviewsSectionProps {
  reviews: Review[];
  average: number | null;
  count: number;
  canReview: boolean;
  loading: boolean;
  onSubmit: (input: { rating: number; comment?: string }) => Promise<void>;
  // Fase 7.5, hallazgo real: no existía forma de que el vendedor
  // respondiera una reseña de su producto. isOwner ya lo resuelve
  // ProductoPageClient (mismo criterio que QuestionsSection); onReply
  // opcional porque solo el dueño del producto lo necesita.
  isOwner?: boolean;
  onReply?: (reviewId: string, replyText: string) => Promise<void>;
}

export function ReviewsSection({
  reviews,
  average,
  count,
  canReview,
  loading,
  onSubmit,
  isOwner = false,
  onReply,
}: ReviewsSectionProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() || undefined });
      setComment("");
      setRating(5);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Reseñas</h2>

      {count > 0 ? (
        <div className="flex items-center gap-2">
          <RatingStars value={average ?? 0} />
          <span className="text-sm text-muted-foreground">
            {average?.toFixed(1)} ({count} {count === 1 ? "reseña" : "reseñas"})
          </span>
        </div>
      ) : null}

      {/* El formulario SOLO aparece si canReview.allowed es true — la RLS
          (reviews_insert_verified_purchase) lo exige de todos modos, esto
          es solo para no ofrecer una acción que el servidor rechazaría. */}
      {canReview ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Deja tu reseña</p>
          <RatingStars value={rating} onChange={setRating} />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="¿Qué te pareció el producto? (opcional)"
            rows={3}
          />
          <Button onClick={handleSubmit} disabled={submitting} className="self-start">
            Enviar reseña
          </Button>
        </div>
      ) : null}

      {loading ? null : reviews.length === 0 ? (
        <EmptyState title="Todavía no hay reseñas" />
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} isOwner={isOwner} onReply={onReply} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewItem({
  review,
  isOwner,
  onReply,
}: {
  review: Review;
  isOwner: boolean;
  onReply?: (reviewId: string, replyText: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canReplyInline = isOwner && !review.seller_reply && !!onReply;

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed || !onReply) return;
    setSubmitting(true);
    try {
      await onReply(review.id, trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0">
      <div className="flex items-center gap-2">
        <RatingStars value={review.rating} size={14} />
        <span className="text-xs text-muted-foreground">
          {/* Sin nombre de autor: profiles solo es legible por su
              dueño o admin (Fase 2.3) — "Comprador verificado" es
              cierto porque la RLS de reviews ya lo garantiza. */}
          Comprador verificado ·{" "}
          {new Date(review.created_at).toLocaleDateString("es-CO")}
        </span>
      </div>
      {review.comment ? <p className="text-sm">{review.comment}</p> : null}

      {review.seller_reply ? (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l-2 border-primary/30 pl-3">
          <span className="text-xs font-medium text-primary">Respuesta del vendedor</span>
          <p className="text-sm text-muted-foreground">{review.seller_reply}</p>
        </div>
      ) : canReplyInline ? (
        <div className="ml-4 mt-1 flex flex-col gap-2 border-l-2 border-primary/30 pl-3 sm:flex-row">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Responder esta reseña…"
            rows={2}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !draft.trim()}>
            Responder
          </Button>
        </div>
      ) : null}
    </li>
  );
}
