"use client";

import { useCallback, useEffect, useState } from "react";
import * as reviewService from "@/services/review.service";
import type { CanReviewResult } from "@/services/review.service";
import type { Review } from "@/types/review";

const NOT_ALLOWED: CanReviewResult = { allowed: false, orderId: null };

export function useReviews(productId: string, userId?: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [canReview, setCanReview] = useState<CanReviewResult>(NOT_ALLOWED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      reviewService.listByProduct(productId),
      reviewService.getAverage(productId),
      userId ? reviewService.canReview(productId, userId) : Promise.resolve(NOT_ALLOWED),
    ])
      .then(([reviewsData, avgData, canReviewData]) => {
        setReviews(reviewsData);
        setAverage(avgData.average);
        setCount(avgData.count);
        setCanReview(canReviewData);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [productId, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submit = useCallback(
    async (input: { buyerId: string; rating: number; comment?: string }) => {
      if (!canReview.orderId) {
        throw new Error("No puedes reseñar este producto todavía.");
      }
      await reviewService.create({
        productId,
        buyerId: input.buyerId,
        orderId: canReview.orderId,
        rating: input.rating,
        comment: input.comment,
      });
      await fetchAll();
    },
    [productId, canReview.orderId, fetchAll],
  );

  return { reviews, average, count, canReview, loading, error, submit, retry: fetchAll };
}
