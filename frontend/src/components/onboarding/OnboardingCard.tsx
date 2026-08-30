// src/components/onboarding/OnboardingCard.tsx — Premium Edition v2
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader } from "#/components/ui/card";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "#/components/ui/dialog";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Terminal,
  UserMinus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
  Trash2,
  Mail,
  FolderOpen,
  Ticket,
  User,
  AlertTriangle,
  Calendar,
  Building2,
  ArrowRight,
} from "lucide-react";
import type { OnboardedUserListItem, OnboardingWorkflowStatus } from "#/types/onboarding";
import { useRetryOnboarding, useOffboardUser, useRollbackOnboarding } from "#/hooks/useOnboarding";
import { toast } from "sonner";
import { cn } from "#/lib/utils";

// ---------------------------------------------------------------------------
// Step Configuration
// ---------------------------------------------------------------------------

interface StepConfig {
  readonly key: OnboardingWorkflowStatus;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly activeColor: string;
  readonly completedColor: string;
}

const STEPS: StepConfig[] = [
  {
    key: "PENDING",
    label: "Ausstehend",
    icon: <Circle className="h-3.5 w-3.5" />,
    activeColor: "text-muted-foreground",
    completedColor: "text-success",
  },
  {
    key: "AD_CREATING",
    label: "AD wird erstellt",
    icon: <FolderOpen className="h-3.5 w-3.5" />,
    activeColor: "text-primary",
    completedColor: "text-success",
  },
  {
    key: "EMAIL_SENDING",
    label: "E-Mail wird gesendet",
    icon: <Mail className="h-3.5 w-3.5" />,
    activeColor: "text-info",
    completedColor: "text-success",
  },
  {
    key: "JIRA_CREATING",
    label: "Jira-Ticket wird erstellt",
    icon: <Ticket className="h-3.5 w-3.5" />,
    activeColor: "text-warning",
    completedColor: "text-success",
  },
  {
    key: "COMPLETED",
    label: "Abgeschlossen",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    activeColor: "text-success",
    completedColor: "text-success",
  },
];

// ---------------------------------------------------------------------------
// Status Configuration
// ---------------------------------------------------------------------------

const statusConfig: Record<
  OnboardingWorkflowStatus,
  {
    gradient: string;
    icon: React.ReactNode;
    label: string;
    badgeClass: string;
    pulseColor: string;
    ringColor: string;
  }
> = {
  PENDING: {
    gradient: "from-muted-foreground/30 to-muted-foreground/10",
    icon: <Circle className="h-3.5 w-3.5" />,
    label: "Ausstehend",
    badgeClass: "bg-muted/60 text-muted-foreground border-muted",
    pulseColor: "hsl(220 10% 50% / 0.08)",
    ringColor: "hsl(220 10% 50% / 0.25)",
  },
  AD_CREATING: {
    gradient: "from-primary/60 to-primary/15",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "AD Erstellung",
    badgeClass: "bg-primary/8 text-primary border-primary/20",
    pulseColor: "hsl(224 76% 48% / 0.08)",
    ringColor: "hsl(224 76% 48% / 0.30)",
  },
  EMAIL_SENDING: {
    gradient: "from-info/60 to-info/15",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "E-Mail Versand",
    badgeClass: "bg-info/8 text-info border-info/20",
    pulseColor: "hsl(199 85% 48% / 0.08)",
    ringColor: "hsl(199 85% 48% / 0.30)",
  },
  JIRA_CREATING: {
    gradient: "from-warning/60 to-warning/15",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "Jira Erstellung",
    badgeClass: "bg-warning/8 text-warning border-warning/20",
    pulseColor: "hsl(35 90% 48% / 0.08)",
    ringColor: "hsl(35 90% 48% / 0.30)",
  },
  PARTIALLY_COMPLETE: {
    gradient: "from-amber-500/60 to-amber-500/15",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: "Teilweise abgeschlossen",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/25",
    pulseColor: "hsl(38 92% 50% / 0.08)",
    ringColor: "hsl(38 92% 50% / 0.30)",
  },
  COMPLETED: {
    gradient: "from-success/60 to-success/15",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Abgeschlossen",
    badgeClass: "bg-success/8 text-success border-success/20",
    pulseColor: "hsl(150 60% 42% / 0.08)",
    ringColor: "hsl(150 60% 42% / 0.30)",
  },
  FAILED: {
    gradient: "from-danger/60 to-danger/15",
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Fehlgeschlagen",
    badgeClass: "bg-danger/8 text-danger border-danger/20",
    pulseColor: "hsl(0 72% 55% / 0.08)",
    ringColor: "hsl(0 72% 55% / 0.30)",
  },
};

// ---------------------------------------------------------------------------
// Simulation Log Generator
// ---------------------------------------------------------------------------

function generateSimulationLog(record: OnboardedUserListItem): string[] {
  const logs: string[] = [];
  const name = `${record.first_name} ${record.last_name}`;
  const reachedOrPast = (statuses: OnboardingWorkflowStatus[]) => statuses.includes(record.workflow_status);

  if (record.workflow_status !== "PENDING") {
    logs.push(`POST https://n8n.instance.com/webhook/onboard-start\nPayload: { "first_name": "${record.first_name}", "email": "${record.email}", "department": "${record.department}" }`);
  }
  if (reachedOrPast(["AD_CREATING", "EMAIL_SENDING", "JIRA_CREATING", "PARTIALLY_COMPLETE", "COMPLETED"])) {
    logs.push(`POST https://n8n.instance.com/webhook/ad-create\nPayload: { "user": "${name}", "ou": "${record.department}", "source": "${record.provisioning_source}" }`);
  }
  if (reachedOrPast(["EMAIL_SENDING", "JIRA_CREATING", "PARTIALLY_COMPLETE", "COMPLETED"])) {
    logs.push(`POST https://n8n.instance.com/webhook/email-send\nPayload: { "to": "${record.email}", "template": "welcome" }`);
  }
  if (reachedOrPast(["JIRA_CREATING", "COMPLETED"])) {
    logs.push(`POST https://n8n.instance.com/webhook/jira-ticket\nPayload: { "summary": "IT Setup for ${name}", "priority": "High" }`);
  }
  if (record.workflow_status === "PARTIALLY_COMPLETE") {
    logs.push(`\n⚠ Konto existiert im Verzeichnis — keine Bestätigung für E-Mail/Jira erhalten.`);
  }
  if (record.workflow_status === "FAILED" && record.error_message) {
    logs.push(`\n❌ ERROR: ${record.error_message}`);
  }

  return logs;
}

// ---------------------------------------------------------------------------
// Status Change Animation Hook
// ---------------------------------------------------------------------------

function useStatusAnimation(status: OnboardingWorkflowStatus): boolean {
  const prevStatusRef = useRef<OnboardingWorkflowStatus>(status);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1800);
      prevStatusRef.current = status;
      return () => clearTimeout(timer);
    }
  }, [status]);

  return isAnimating;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OnboardingCardProps {
  readonly record: OnboardedUserListItem;
  readonly compact?: boolean;
}

// ---------------------------------------------------------------------------
// Compact Card — For Completed Column (CLICK TO EXPAND)
// ---------------------------------------------------------------------------

function CompactCard({ record }: { record: OnboardedUserListItem }): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const isAnimating = useStatusAnimation(record.workflow_status);
  const config = statusConfig[record.workflow_status];
  const isOffboarded = record.status === "offboarded";

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl border border-border/50",
          "bg-card/60 px-3 py-2.5 text-left",
          "transition-all duration-300 ease-premium",
          "hover:bg-card hover:border-border/80 hover:shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isExpanded && "bg-card border-border/80 shadow-sm",
          isAnimating && "animate-status-pulse"
        )}
        style={isAnimating ? { "--pulse-color": config.pulseColor, "--ring-color": config.ringColor } as React.CSSProperties : undefined}
        aria-expanded={isExpanded}
      >
        {isAnimating && (
          <span
            className="absolute inset-0 rounded-xl animate-status-ring pointer-events-none"
            style={{ "--ring-color": config.ringColor } as React.CSSProperties}
            aria-hidden="true"
          />
        )}

        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            "bg-gradient-to-br",
            config.gradient
          )}
        >
          <User className="h-3.5 w-3.5 text-foreground/70" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground/80 truncate">
            {record.first_name} {record.last_name}
          </p>
          <p className="text-[10px] text-muted-foreground/50 truncate">{record.department}</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-1.5 py-0 text-[9px] font-semibold border",
              config.badgeClass
            )}
          >
            {config.icon}
          </Badge>
          {isOffboarded && (
            <span className="text-[9px] text-muted-foreground/40 font-medium">Offboarded</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-500 ease-premium",
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-4">
          <div className="space-y-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
              Onboarding-Verlauf
            </p>
            {STEPS.map((step, idx) => {
              const isLast = idx === STEPS.length - 1;
              const recordStepIndex = STEPS.findIndex((s) => s.key === record.workflow_status);
              const isCompleted = idx <= recordStepIndex;
              const isCurrent = idx === recordStepIndex;

              return (
                <div key={step.key} className="relative flex items-start gap-2.5">
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute left-[9px] top-5 bottom-[-8px] w-px",
                        isCompleted ? "bg-success/30" : "bg-border/30"
                      )}
                      aria-hidden="true"
                    />
                  )}
                  <div
                    className={cn(
                      "relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 mt-0.5",
                      isCompleted
                        ? "bg-success border-success text-white"
                        : "bg-card border-muted-foreground/20 text-muted-foreground/30"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] leading-[18px] pb-2",
                      isCompleted
                        ? isCurrent
                          ? "text-success font-semibold"
                          : "text-success font-medium"
                        : "text-muted-foreground/30"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <MetadataItem
              icon={<Calendar className="h-3 w-3" />}
              label="Erstellt am"
              value={new Date(record.created_at).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            />
            <MetadataItem
              icon={<Building2 className="h-3 w-3" />}
              label="Quelle"
              value={record.provisioning_source}
            />
            <MetadataItem
              icon={<User className="h-3 w-3" />}
              label="Angefordert von"
              value={record.requested_by ?? "–"}
            />
            <MetadataItem
              icon={<ArrowRight className="h-3 w-3" />}
              label="Status"
              value={isOffboarded ? "Offboarded" : "Aktiv"}
              valueColor={isOffboarded ? "text-muted-foreground" : "text-success"}
            />
          </div>

          <SimulationLogPanel record={record} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metadata Item
// ---------------------------------------------------------------------------

function MetadataItem({
  icon,
  label,
  value,
  valueColor = "text-foreground/80",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}): JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground/50">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/40 font-medium">{label}</p>
        <p className={cn("text-[11px] font-semibold truncate capitalize", valueColor)}>{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simulation Log Panel
// ---------------------------------------------------------------------------

function SimulationLogPanel({ record }: { record: OnboardedUserListItem }): JSX.Element {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <button
        onClick={() => setShowLogs(!showLogs)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2",
          "bg-muted/30 hover:bg-muted/50 transition-colors",
          "text-[11px] font-mono text-muted-foreground/60"
        )}
        aria-expanded={showLogs}
      >
        <span className="flex items-center gap-2">
          <Terminal className="h-3 w-3" />
          Simulations-Protokoll
        </span>
        <span className="text-muted-foreground/30">
          {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>
      {showLogs && (
        <div className="p-3 bg-black/[0.85] text-green-400/90 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {generateSimulationLog(record).join("\n\n")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Card — For Active Columns
// ---------------------------------------------------------------------------

function FullCard({ record }: { record: OnboardedUserListItem }): JSX.Element {
  const retryMutation = useRetryOnboarding();
  const offboardMutation = useOffboardUser();
  const rollbackMutation = useRollbackOnboarding();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [rotatePassword, setRotatePassword] = useState(false);
  const isAnimating = useStatusAnimation(record.workflow_status);

  const config = statusConfig[record.workflow_status];
  const isOffboarded = record.status === "offboarded";
  const canOffboard = !isOffboarded && record.workflow_status === "COMPLETED";
  const isFailed = record.workflow_status === "FAILED";
  const isPartial = record.workflow_status === "PARTIALLY_COMPLETE";
  const canRetry = (isFailed || isPartial) && !isOffboarded;
  const canRollback = (isFailed || isPartial) && !isOffboarded;

  const currentStepIndex = STEPS.findIndex((s) => s.key === record.workflow_status);
  // PARTIALLY_COMPLETE isn't itself a STEPS entry — the directory account is
  // confirmed to exist (AD_CREATING succeeded), but what happened after
  // that point is unconfirmed, not failed. Anchor the timeline at
  // EMAIL_SENDING rather than pretending to know more than we do.
  const effectiveStepIndex = isPartial ? STEPS.findIndex((s) => s.key === "EMAIL_SENDING") : currentStepIndex;
  const displaySteps = isFailed || isPartial ? STEPS : STEPS.slice(0, currentStepIndex + 1);

  const handleOffboardConfirm = () => {
    offboardMutation.mutate(record.user_id, { onSuccess: () => setConfirmOpen(false) });
  };

  const handleRollbackConfirm = () => {
    rollbackMutation.mutate(record.user_id, { onSuccess: () => setRollbackConfirmOpen(false) });
  };

  const handleRetry = () => {
    if (!record.job_id) {
      toast.error("Fehler: job_id fehlt. Bitte Backend-Schema prüfen.");
      return;
    }
    retryMutation.mutate({ jobId: record.job_id, rotatePassword: isPartial ? rotatePassword : true });
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60",
        "shadow-sm transition-all duration-300 ease-premium",
        "hover:shadow-card-hover hover:-translate-y-0.5",
        isFailed && "border-l-[3px] border-l-danger",
        isPartial && "border-l-[3px] border-l-amber-500",
        isAnimating && "animate-status-pulse"
      )}
      style={isAnimating ? { "--pulse-color": config.pulseColor, "--ring-color": config.ringColor } as React.CSSProperties : undefined}
    >
      {isAnimating && (
        <span
          className="absolute inset-0 rounded-xl animate-status-ring pointer-events-none z-20"
          style={{ "--ring-color": config.ringColor } as React.CSSProperties}
          aria-hidden="true"
        />
      )}

      {!isFailed && !isPartial && (
        <div
          className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b", config.gradient)}
          aria-hidden="true"
        />
      )}

      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground/90 truncate">
                {record.first_name} {record.last_name}
              </h4>
              {isOffboarded && (
                <Badge
                  variant="outline"
                  className="rounded-full px-1.5 py-0 text-[9px] font-semibold bg-muted/60 text-muted-foreground border-muted shrink-0"
                >
                  <UserMinus className="h-2.5 w-2.5 mr-0.5" />
                  Offboarded
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
              {record.job_title} • {record.department}
            </p>
            <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-mono truncate">
              {record.email}
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0 flex items-center gap-1",
              config.badgeClass
            )}
          >
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4">
        {/* Step Timeline */}
        <div className="space-y-0">
          {displaySteps.map((step, idx) => {
            const isCompleted = idx < effectiveStepIndex && !isFailed && !isPartial;
            const isCurrent = idx === effectiveStepIndex && !isFailed && !isPartial;
            const isUnconfirmedStep = isPartial && idx >= effectiveStepIndex;
            const isLast = idx === displaySteps.length - 1;

            return (
              <div key={step.key} className="relative flex items-start gap-2.5">
                {!isLast && (
                  <div
                    className={cn(
                      "absolute left-[9px] top-5 bottom-[-8px] w-px",
                      isCompleted ? "bg-success/30" : "bg-border/40"
                    )}
                    aria-hidden="true"
                  />
                )}

                <div
                  className={cn(
                    "relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 mt-0.5",
                    isCompleted
                      ? "bg-success border-success text-white"
                      : isCurrent
                        ? "bg-card border-primary text-primary"
                        : isUnconfirmedStep
                          ? "bg-amber-500/15 border-amber-500 text-amber-600"
                          : "bg-card border-muted-foreground/20 text-muted-foreground/40"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : isUnconfirmedStep ? (
                    <AlertTriangle className="h-2.5 w-2.5" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </div>

                <span
                  className={cn(
                    "text-[11px] leading-[18px] pb-2",
                    isCompleted
                      ? "text-success font-medium"
                      : isCurrent
                        ? "text-foreground font-semibold"
                        : isUnconfirmedStep
                          ? "text-amber-600 font-medium"
                          : "text-muted-foreground/40"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {(isFailed || isPartial) && record.error_message && (
          <p
            className={cn(
              "text-[11px] rounded-lg px-2.5 py-2 leading-relaxed border",
              isFailed
                ? "text-danger bg-danger/8 border-danger/20"
                : "text-amber-600/90 bg-amber-500/8 border-amber-500/20"
            )}
          >
            {record.error_message}
          </p>
        )}

        <SimulationLogPanel record={record} />

        {/* Retry (FAILED) / Resend (PARTIALLY_COMPLETE) */}
        {canRetry && (
          <div className="space-y-2">
            {isPartial && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground/70 cursor-pointer select-none">
                <Checkbox
                  checked={rotatePassword}
                  onCheckedChange={(checked) => setRotatePassword(checked === true)}
                />
                Neues Passwort generieren (widerruft ein ggf. bereits zugestelltes Passwort)
              </label>
            )}
            <Button
              size="sm"
              className="w-full rounded-xl gap-2"
              onClick={handleRetry}
              disabled={retryMutation.isPending || !record.job_id}
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPartial ? (
                <Send className="h-3.5 w-3.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {isPartial ? "Benachrichtigungen erneut senden" : "Vorgang wiederholen"}
            </Button>
          </div>
        )}

        {/* Rollback — hard delete. Only for FAILED / PARTIALLY_COMPLETE, never COMPLETED. */}
        {canRollback && (
          <Dialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
            <DialogTrigger className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-danger/30 bg-background h-9 px-3 text-xs font-medium text-danger ring-offset-background transition-colors hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
              Vorgang löschen
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] rounded-2xl">
              <DialogHeader className="gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15">
                  <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Vorgang endgültig löschen?</DialogTitle>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed mt-1.5">
                    Dies entfernt den Datensatz für{" "}
                    <strong className="text-foreground">{record.first_name} {record.last_name}</strong>{" "}
                    unwiderruflich — inklusive eines eventuell bereits angelegten Verzeichniseintrags.
                    Dies ist <strong>kein</strong> Offboarding und kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setRollbackConfirmOpen(false)}
                  disabled={rollbackMutation.isPending}
                  className="rounded-xl"
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRollbackConfirm}
                  disabled={rollbackMutation.isPending}
                  className="rounded-xl gap-2"
                >
                  {rollbackMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Ja, endgültig löschen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {canOffboard && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-input bg-background h-9 px-3 text-xs font-medium text-danger ring-offset-background transition-colors hover:bg-accent hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              <UserMinus className="h-3.5 w-3.5" />
              Offboarden
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px] rounded-2xl">
              <DialogHeader className="gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15">
                  <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Zugriff widerrufen?</DialogTitle>
                  <p className="text-sm text-muted-foreground/80 leading-relaxed mt-1.5">
                    Dadurch wird der Verzeichniszugriff für{" "}
                    <strong className="text-foreground">{record.first_name} {record.last_name}</strong>{" "}
                    widerrufen. Dies ist eine Soft-Delete-Operation.
                  </p>
                </div>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={offboardMutation.isPending}
                  className="rounded-xl"
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleOffboardConfirm}
                  disabled={offboardMutation.isPending}
                  className="rounded-xl gap-2"
                >
                  {offboardMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserMinus className="h-3.5 w-3.5" />
                  )}
                  Ja, offboarden
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

export function OnboardingCard({ record, compact = false }: OnboardingCardProps): JSX.Element {
  if (compact) {
    return <CompactCard record={record} />;
  }
  return <FullCard record={record} />;
}