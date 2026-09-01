"use client";

import { useCallback, useEffect, useState } from "react";
import { getSellerPublicProfile, type SellerPublicProfile } from "@/services/seller.service";

// Separado de useProducts (que trae los productos del storefront): son dos
// fetches independientes con su propio loading/error, así que la sección
// "quién vende esto" puede terminar de cargar antes o después que la
// grilla sin que uno bloquee al otro.
export function useSellerPublicProfile(sellerId: string | undefined) {
  const [profile, setProfile] = useState<SellerPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(() => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getSellerPublicProfile(sellerId)
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [sellerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, retry: fetchProfile };
}
