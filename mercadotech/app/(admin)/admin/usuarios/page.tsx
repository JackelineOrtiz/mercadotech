"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { UsersTable } from "@/components/admin/UsersTable";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AdminUsersPage() {
  const { profile } = useAuth();
  const { users, loading, error, retry, changeRole } = useAdminUsers();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      {error ? (
        <ErrorState onRetry={retry} />
      ) : loading ? (
        <LoadingState rows={4} />
      ) : users.length === 0 ? (
        <EmptyState title="Sin usuarios" description="Todavía no hay usuarios registrados." />
      ) : (
        <UsersTable users={users} currentUserId={profile?.id} onChangeRole={changeRole} />
      )}
    </div>
  );
}
