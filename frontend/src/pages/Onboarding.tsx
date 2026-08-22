// src/pages/Onboarding.tsx — Premium Edition with Offboarding
import { useState, useMemo } from "react";
import { useOnboardingList, useWatchedJobIds } from "#/hooks/useOnboarding";
import { OnboardingCard } from "#/components/onboarding/OnboardingCard";
import { OnboardingFormDialog } from "#/components/onboarding/OnboardingFormDialog";
import { OnboardingJobStreamSubscriber } from "#/components/onboarding/OnboardingJobStreamSubscriber";
import { TableSkeleton } from "#/components/feedback/TableSkeleton";
import { cn } from "#/lib/utils";
import {
  LayoutList,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  UserMinus,
  Users,
  ShieldOff,
} from "lucide-react";
import type { OnboardingWorkflowStatus } from "#/types/onboarding";

// ---------------------------------------------------------------------------
// Column Configuration
// ---------------------------------------------------------------------------

interface ColumnConfig {
  id: OnboardingWorkflowStatus;
  label: string;
  description: string;
  accent: string;
  icon: React.ReactNode;
  isActive: boolean;
}

const COLUMN_CONFIG: ColumnConfig[] = [
  {
    id: "PENDING",
    label: "Ausstehend",
    description: "Wartet auf Start",
    accent: "bg-muted-foreground/40",
    icon: <Clock className="h-3.5 w-3.5" />,
    isActive: true,
  },
  {
    id: "AD_CREATING",
    label: "AD Erstellung",
    description: "Active Directory",
    accent: "bg-primary",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    isActive: true,
  },
  {
    id: "EMAIL_SENDING",
    label: "E-Mail Versand",
    description: "Willkommens-E-Mail",
    accent: "bg-info",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    isActive: true,
  },
  {
    id: "JIRA_CREATING",
    label: "Jira Erstellung",
    description: "Ticket wird erstellt",
    accent: "bg-warning",
    icon: <Loader2 className="h-3.5 w-3.5" />,
    isActive: true,
  },
  {
    id: "COMPLETED",
    label: "Abgeschlossen",
    description: "Erfolgreich onboarded",
    accent: "bg-success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    isActive: false,
  },
  {
    id: "FAILED",
    label: "Fehlgeschlagen",
    description: "Erfordert Eingriff",
    accent: "bg-danger",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Pipeline Stat Pill
// ---------------------------------------------------------------------------

interface PipelineStatProps {
  readonly label: string;
  readonly value: number;
  readonly icon: React.ReactNode;
  readonly color: "primary" | "success" | "warning" | "danger" | "muted";
  readonly trend?: string;
}

function PipelineStat({ label, value, icon, color, trend }: PipelineStatProps): JSX.Element {
  const colorMap = {
    primary: {
      bg: "bg-primary/6",
      text: "text-primary",
      iconBg: "bg-primary/10",
      ring: "ring-primary/15",
    },
    success: {
      bg: "bg-success/6",
      text: "text-success",
      iconBg: "bg-success/10",
      ring: "ring-success/15",
    },
    warning: {
      bg: "bg-warning/6",
      text: "text-warning",
      iconBg: "bg-warning/10",
      ring: "ring-warning/15",
    },
    danger: {
      bg: "bg-danger/6",
      text: "text-danger",
      iconBg: "bg-danger/10",
      ring: "ring-danger/15",
    },
    muted: {
      bg: "bg-muted/40",
      text: "text-muted-foreground",
      iconBg: "bg-muted",
      ring: "ring-border",
    },
  };

  const c = colorMap[color];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3",
        "border border-border/60",
        "bg-card",
        "shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          c.iconBg,
          "ring-1",
          c.ring
        )}
      >
        <span className={c.text}>{icon}</span>
      </div>
      <div>
        <p className={cn("text-lg font-bold tabular-nums tracking-tight leading-none", c.text)}>
          {value}
        </p>
        <p className="text-[11px] font-medium text-muted-foreground/60 mt-1 flex items-center gap-1">
          {label}
          {trend && (
            <span className="inline-flex items-center gap-0.5 text-success text-[10px]">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  readonly config: ColumnConfig;
  readonly count: number;
  readonly isCollapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly isCollapsible: boolean;
}

function ColumnHeader({
  config,
  count,
  isCollapsed,
  onToggleCollapse,
  isCollapsible,
}: ColumnHeaderProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl px-3 py-2.5",
        "bg-card border border-border/60 shadow-sm",
        "transition-colors duration-200"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", config.accent)} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/80 truncate">
              {config.label}
            </h3>
            <span
              className={cn(
                "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5",
                "text-[10px] font-bold tabular-nums",
                count > 0 ? "bg-primary/8 text-primary" : "bg-muted text-muted-foreground/50"
              )}
            >
              {count}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 truncate">{config.description}</p>
        </div>
      </div>

      {isCollapsible && (
        <button
          onClick={onToggleCollapse}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-colors"
          aria-label={isCollapsed ? "Spalte erweitern" : "Spalte einklappen"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty Column State
// ---------------------------------------------------------------------------

function EmptyColumnState(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-8 px-4 text-center">
      <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center mb-2">
        <LayoutList className="h-3.5 w-3.5 text-muted-foreground/30" />
      </div>
      <p className="text-[11px] text-muted-foreground/40 font-medium">Keine Vorgänge</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offboarded User Compact Card
// ---------------------------------------------------------------------------

function OffboardedCard({ record }: { record: import("#/types/onboarding").OnboardedUserListItem }): JSX.Element {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border/50",
        "bg-card/40 px-3 py-2.5",
        "transition-all duration-200 ease-premium",
        "hover:bg-card/70 hover:border-border/70"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          "bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/5",
          "ring-1 ring-border/40"
        )}
      >
        <ShieldOff className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground/70 truncate">
          {record.first_name} {record.last_name}
        </p>
        <p className="text-[10px] text-muted-foreground/40 truncate">
          {record.department} • {record.job_title}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground/30 font-medium tabular-nums shrink-0">
        {record.offboarded_at
          ? new Date(record.offboarded_at).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "short",
            })
          : "–"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OnboardingPage(): JSX.Element {
  const { data: records, isLoading, isError } = useOnboardingList();
  const { data: watchedJobIds = [] } = useWatchedJobIds();
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(["COMPLETED"]));
  const [showOffboarded, setShowOffboarded] = useState(false);

  const toggleColumn = (columnId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  // Pipeline stats
  const stats = useMemo(() => {
    if (!records) return { active: 0, inProgress: 0, completed: 0, failed: 0, offboarded: 0 };
    return {
      active: records.filter((r) => r.workflow_status !== "COMPLETED" && r.workflow_status !== "FAILED" && r.status !== "offboarded").length,
      inProgress: records.filter((r) =>
        ["AD_CREATING", "EMAIL_SENDING", "JIRA_CREATING"].includes(r.workflow_status) && r.status !== "offboarded"
      ).length,
      completed: records.filter((r) => r.workflow_status === "COMPLETED" && r.status !== "offboarded").length,
      failed: records.filter((r) => r.workflow_status === "FAILED" && r.status !== "offboarded").length,
      offboarded: records.filter((r) => r.status === "offboarded").length,
    };
  }, [records]);

  const offboardedRecords = useMemo(() => {
    return records?.filter((r) => r.status === "offboarded") ?? [];
  }, [records]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient sm:text-3xl">Onboarding Tracker</h1>
          <p className="text-sm text-muted-foreground/70 mt-1.5">Pipeline-Übersicht wird geladen…</p>
        </div>
        <TableSkeleton rows={4} columns={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15 mb-4">
          <AlertTriangle className="h-6 w-6 text-danger" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/90">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
          Die Onboarding-Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SSE Job Stream Subscribers */}
      {watchedJobIds.map((jobId) => (
        <OnboardingJobStreamSubscriber key={jobId} jobId={jobId} active />
      ))}

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient sm:text-3xl">
            Onboarding Tracker
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1.5 max-w-xl leading-relaxed">
            Verwalten und überwachen Sie Automatisierungs-Workflows für neue Mitarbeiter.
          </p>
        </div>
        <OnboardingFormDialog />
      </header>

      {/* Pipeline Stats Hero */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4" aria-label="Pipeline-Statistiken">
        <PipelineStat
          label="Aktive Vorgänge"
          value={stats.active}
          icon={<Loader2 className="h-4 w-4" />}
          color="primary"
        />
        <PipelineStat
          label="In Bearbeitung"
          value={stats.inProgress}
          icon={<Clock className="h-4 w-4" />}
          color="warning"
        />
        <PipelineStat
          label="Abgeschlossen"
          value={stats.completed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="success"
          trend="diese Woche"
        />
        <PipelineStat
          label="Fehlgeschlagen"
          value={stats.failed}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={stats.failed > 0 ? "danger" : "muted"}
        />
        <PipelineStat
          label="Offboarded"
          value={stats.offboarded}
          icon={<UserMinus className="h-4 w-4" />}
          color="muted"
        />
      </section>

      {/* Kanban Board */}
      <section aria-label="Onboarding-Pipeline">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {COLUMN_CONFIG.map((column) => {
            const columnRecords = records?.filter((r) => r.workflow_status === column.id && r.status !== "offboarded") || [];
            const isCollapsed = collapsedColumns.has(column.id);
            const isCompletedColumn = column.id === "COMPLETED";

            return (
              <div key={column.id} className="flex flex-col gap-3 min-w-0">
                <ColumnHeader
                  config={column}
                  count={columnRecords.length}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleColumn(column.id)}
                  isCollapsible={isCompletedColumn}
                />

                {/* Column Content */}
                <div
                  className={cn(
                    "flex flex-col gap-3 transition-all duration-300 ease-premium overflow-hidden",
                    isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                  )}
                >
                  {columnRecords.length === 0 ? (
                    <EmptyColumnState />
                  ) : (
                    columnRecords.map((record) => (
                      <OnboardingCard
                        key={record.user_id}
                        record={record}
                        compact={isCompletedColumn}
                      />
                    ))
                  )}
                </div>

                {/* Collapsed Preview for Completed */}
                {isCollapsed && isCompletedColumn && columnRecords.length > 0 && (
                  <button
                    onClick={() => toggleColumn(column.id)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 py-3 text-xs text-muted-foreground/50 hover:text-muted-foreground hover:border-border/80 hover:bg-accent/30 transition-all"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    {columnRecords.length} abgeschlossene Vorgänge
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Offboarding Section */}
      {offboardedRecords.length > 0 && (
        <section className="space-y-4" aria-label="Offboardete Benutzer">
          <button
            onClick={() => setShowOffboarded(!showOffboarded)}
            className={cn(
              "flex items-center gap-3 w-full rounded-xl border border-border/60 bg-card px-4 py-3",
              "shadow-sm transition-all duration-200",
              "hover:bg-accent/30 hover:border-border/80"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                "bg-gradient-to-br from-muted-foreground/15 to-muted-foreground/5",
                "ring-1 ring-border/50"
              )}
            >
              <Users className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-semibold text-foreground/80">Offboardete Benutzer</h3>
              <p className="text-[11px] text-muted-foreground/50">
                {offboardedRecords.length} {offboardedRecords.length === 1 ? "Zugriff widerrufen" : "Zugriffe widerrufen"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/40 font-medium tabular-nums">
                {offboardedRecords.length}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground/40 transition-transform duration-300",
                  showOffboarded && "rotate-180"
                )}
              />
            </div>
          </button>

          <div
            className={cn(
              "overflow-hidden transition-all duration-500 ease-premium",
              showOffboarded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {offboardedRecords.map((record) => (
                <OffboardedCard key={record.user_id} record={record} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}