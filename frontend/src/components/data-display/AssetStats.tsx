// frontend/src/components/data-display/AssetStats.tsx
import { useAssetStats } from "#/hooks/useAssets";
import { Server, Activity, Power, AlertTriangle } from "lucide-react";
import { cn } from "#/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCardProps {
  readonly title: string;
  readonly value: number;
  readonly icon: React.ReactNode;
  readonly color: "primary" | "success" | "warning" | "danger";
  readonly isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Variant Configuration
// ---------------------------------------------------------------------------

const colorConfig = {
  primary: {
    gradient: "from-primary/80 to-primary/20",
    iconGradient: "from-primary/12 to-primary/4",
    iconColor: "text-primary",
    ring: "ring-primary/15",
  },
  success: {
    gradient: "from-success/80 to-success/20",
    iconGradient: "from-success/12 to-success/4",
    iconColor: "text-success",
    ring: "ring-success/15",
  },
  warning: {
    gradient: "from-warning/80 to-warning/20",
    iconGradient: "from-warning/12 to-warning/4",
    iconColor: "text-warning",
    ring: "ring-warning/15",
  },
  danger: {
    gradient: "from-danger/80 to-danger/20",
    iconGradient: "from-danger/12 to-danger/4",
    iconColor: "text-danger",
    ring: "ring-danger/15",
  },
};

// ---------------------------------------------------------------------------
// Stat Card — Premium Edition
// ---------------------------------------------------------------------------

function StatCard({ title, value, icon, color, isLoading }: StatCardProps): JSX.Element {
  const config = colorConfig[color];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/80 bg-card",
        "shadow-card dark:shadow-card-dark",
        "transition-all duration-300 ease-premium",
        "hover:shadow-card-hover dark:hover:shadow-card-dark-hover hover:-translate-y-0.5"
      )}
    >
      {/* Left gradient accent */}
      <div
        className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b", config.gradient)}
        aria-hidden="true"
      />

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {title}
            </p>
            {isLoading ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-muted/80" />
            ) : (
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {value.toLocaleString()}
              </p>
            )}
          </div>

          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "bg-gradient-to-br",
              config.iconGradient,
              "ring-1",
              config.ring,
              "transition-transform duration-300 ease-premium",
              "group-hover:scale-105"
            )}
            aria-hidden="true"
          >
            <span className={config.iconColor}>{icon}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AssetStats(): JSX.Element {
  const { data: stats, isLoading } = useAssetStats();

  const cards = [
    {
      title: "Gesamt Assets",
      value: stats?.total ?? 0,
      icon: <Server className="h-5 w-5" />,
      color: "primary" as const,
    },
    {
      title: "Online",
      value: stats?.online ?? 0,
      icon: <Activity className="h-5 w-5" />,
      color: "success" as const,
    },
    {
      title: "Offline",
      value: stats?.offline ?? 0,
      icon: <Power className="h-5 w-5" />,
      color: "warning" as const,
    },
    {
      title: "Health Alerts",
      value: stats?.healthAlerts ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "danger" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} isLoading={isLoading} />
      ))}
    </div>
  );
}