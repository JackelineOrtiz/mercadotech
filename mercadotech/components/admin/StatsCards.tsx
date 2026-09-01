import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Price } from "@/components/shared/Price";

// Prop type propio, NO import type de services/admin.service: un
// componente puro no importa de services/ ni siquiera para un type
// (regla #1 del enforcer, verificado con
// `grep -rl "from \"@/services" components` de CLAUDE.md — ese grep no
// distingue value de type import). Además, solo necesita 4 de los 6
// campos de PlatformStats — este subset documenta mejor qué usa.
export interface StatsCardsProps {
  stats: {
    totalUsers: number;
    totalOrders: number;
    activeProducts: number;
    totalRevenue: number;
  };
}

// Primer uso real de Card en el proyecto (existía en components/ui/ desde
// el scaffold de shadcn, sin consumidores) — cuatro números clave de la
// plataforma, sin desglose por estado/rol acá (eso lo muestran las
// secciones de abajo en la página, no esta grilla).
export function StatsCards({ stats }: StatsCardsProps) {
  const items = [
    { label: "Usuarios totales", value: stats.totalUsers, testId: "stat-total-users" },
    { label: "Pedidos totales", value: stats.totalOrders, testId: "stat-total-orders" },
    { label: "Productos activos", value: stats.activeProducts, testId: "stat-active-products" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} data-testid={item.testId}>
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
      <Card data-testid="stat-total-revenue">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Ingresos totales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Price value={stats.totalRevenue} size="lg" />
        </CardContent>
      </Card>
    </div>
  );
}
