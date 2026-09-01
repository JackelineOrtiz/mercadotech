"use client";

import { useAdminStats } from "@/hooks/useAdminStats";
import { StatsCards } from "@/components/admin/StatsCards";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE_VARIANT,
} from "@/lib/constants/orders";
import { USER_ROLE_LABELS, USER_ROLE_BADGE_VARIANT } from "@/lib/constants/roles";
import { ORDER_STATUSES, USER_ROLES } from "@/lib/constants/roles";

export default function AdminDashboardPage() {
  const { stats, loading, error, retry } = useAdminStats();

  if (loading) {
    return <LoadingState rows={4} />;
  }

  if (error || !stats) {
    return <ErrorState onRetry={retry} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Pedidos por estado</h2>
          <ul className="flex flex-col gap-2">
            {ORDER_STATUSES.map((status) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]}>
                  {ORDER_STATUS_LABELS[status]}
                </Badge>
                <span className="font-medium">{stats.ordersByStatus[status]}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Usuarios por rol</h2>
          <ul className="flex flex-col gap-2">
            {USER_ROLES.map((role) => (
              <li key={role} className="flex items-center justify-between text-sm">
                <Badge variant={USER_ROLE_BADGE_VARIANT[role]}>{USER_ROLE_LABELS[role]}</Badge>
                <span className="font-medium">{stats.usersByRole[role]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
