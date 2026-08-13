//frontend/src/components/data-display/AssetStats.tsx
import { useAssetStats } from "#/hooks/useAssets";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Server, Activity, AlertTriangle, Power } from "lucide-react";
import { cn } from "#/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color: "primary" | "success" | "warning" | "danger";
  isLoading: boolean;
}

function StatCard({ title, value, icon, color, isLoading }: StatCardProps) {
  const colorStyles = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    danger: "bg-danger/10 text-danger border-danger/20",
  };

  return (
    <Card className={cn("border", colorStyles[color])}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn("rounded-md p-2", colorStyles[color])}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AssetStats() {
  const { data: stats, isLoading } = useAssetStats();

  const cards = [
    {
      title: "Gesamt Assets",
      value: stats?.total ?? 0,
      icon: <Server className="h-4 w-4" />,
      color: "primary" as const,
    },
    {
      title: "Online",
      value: stats?.online ?? 0,
      icon: <Activity className="h-4 w-4" />,
      color: "success" as const,
    },
    {
      title: "Offline",
      value: stats?.offline ?? 0,
      icon: <Power className="h-4 w-4" />,
      color: "warning" as const,
    },
    {
      title: "Health Alerts",
      value: stats?.healthAlerts ?? 0,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: "danger" as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}

