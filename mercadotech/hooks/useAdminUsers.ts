"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listUsers, updateUserRole } from "@/services/admin.service";
import type { UserRole } from "@/lib/constants/roles";
import type { Profile } from "@/types/user";

export function useAdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    listUsers()
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Optimista con rollback (mismo patrón que useSellerOrders.move): la
  // validación real ("¿sos admin?") la hace RLS/protect_profiles_role, no
  // este hook — si el rechazo llega (ej. un usuario no-admin llega acá por
  // algún camino inesperado), revierte y avisa con toast en vez de dejar
  // la tabla mostrando un rol que en realidad no se guardó.
  const changeRole = useCallback(
    async (userId: string, role: UserRole) => {
      const previous = users.find((u) => u.id === userId)?.role;
      if (!previous || previous === role) return;

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));

      try {
        await updateUserRole(userId, role);
      } catch (err) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: previous } : u)),
        );
        toast.error((err as Error).message);
      }
    },
    [users],
  );

  return { users, loading, error, retry: fetchUsers, changeRole };
}
