// src/components/onboarding/OnboardingCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "#/components/ui/dialog";
import { CheckCircle2, Circle, XCircle, Loader2, Terminal, UserMinus } from "lucide-react";
import type { OnboardedUserListItem, OnboardingWorkflowStatus } from "#/types/onboarding";
import { useRetryOnboarding, useOffboardUser } from "#/hooks/useOnboarding";
import { useState } from "react";
import { toast } from "sonner";

const STEPS: { key: OnboardingWorkflowStatus; label: string }[] = [
  { key: "PENDING", label: "Ausstehend" },
  { key: "AD_CREATING", label: "AD wird erstellt" },
  { key: "EMAIL_SENDING", label: "E-Mail wird gesendet" },
  { key: "JIRA_CREATING", label: "Jira-Ticket wird erstellt" },
  { key: "COMPLETED", label: "Abgeschlossen" },
];

const statusConfig: Record<OnboardingWorkflowStatus, { color: string; icon: React.ReactNode }> = {
  PENDING: { color: "bg-muted text-muted-foreground", icon: <Circle className="h-4 w-4" /> },
  AD_CREATING: { color: "bg-blue-500/10 text-blue-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  EMAIL_SENDING: { color: "bg-blue-500/10 text-blue-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  JIRA_CREATING: { color: "bg-blue-500/10 text-blue-500", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  COMPLETED: { color: "bg-success/10 text-success", icon: <CheckCircle2 className="h-4 w-4" /> },
  FAILED: { color: "bg-danger/10 text-danger", icon: <XCircle className="h-4 w-4" /> },
};

const generateSimulationLog = (record: OnboardedUserListItem): string[] => {
  const logs: string[] = [];
  const name = `${record.first_name} ${record.last_name}`;

  if (record.workflow_status !== "PENDING") {
    logs.push(`POST https://n8n.instance.com/webhook/onboard-start\nPayload: { "first_name": "${record.first_name}", "email": "${record.email}", "department": "${record.department}" }`);
  }
  if (["AD_CREATING", "EMAIL_SENDING", "JIRA_CREATING", "COMPLETED"].includes(record.workflow_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/ad-create\nPayload: { "user": "${name}", "ou": "${record.department}", "source": "${record.provisioning_source}" }`);
  }
  if (["EMAIL_SENDING", "JIRA_CREATING", "COMPLETED"].includes(record.workflow_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/email-send\nPayload: { "to": "${record.email}", "template": "welcome" }`);
  }
  if (["JIRA_CREATING", "COMPLETED"].includes(record.workflow_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/jira-ticket\nPayload: { "summary": "IT Setup for ${name}", "priority": "High" }`);
  }
  if (record.workflow_status === "FAILED" && record.error_message) {
    logs.push(`\n❌ ERROR: ${record.error_message}`);
  }

  return logs;
};

interface OnboardingCardProps {
  record: OnboardedUserListItem;
}

export function OnboardingCard({ record }: OnboardingCardProps) {
  const retryMutation = useRetryOnboarding();
  const offboardMutation = useOffboardUser();
  const [showLogs, setShowLogs] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const config = statusConfig[record.workflow_status];

  const currentStepIndex = STEPS.findIndex((s) => s.key === record.workflow_status);
  const displaySteps = record.workflow_status === "FAILED" ? STEPS : STEPS.slice(0, currentStepIndex + 1);

  const isOffboarded = record.status === "offboarded";
  const canOffboard = !isOffboarded && record.workflow_status === "COMPLETED";

  const handleOffboardConfirm = () => {
    offboardMutation.mutate(record.user_id, { onSuccess: () => setConfirmOpen(false) });
  };

  return (
    <Card className={`hover:shadow-md transition-shadow border-l-4 ${isOffboarded ? "border-l-muted-foreground/40 opacity-70" : "border-l-primary/50"}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-semibold">{record.first_name} {record.last_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{record.job_title} • {record.department}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{record.email}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="outline" className={`${config.color} border-0 flex items-center gap-1.5`}>
              {config.icon}
              {record.workflow_status === "FAILED" ? "Fehlgeschlagen" : record.workflow_status.replace("_", " ")}
            </Badge>
            {isOffboarded && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-0 flex items-center gap-1.5">
                <UserMinus className="h-3.5 w-3.5" />
                Offboarded
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          {displaySteps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex && record.workflow_status !== "FAILED";
            const isCurrent = idx === currentStepIndex && record.workflow_status !== "FAILED";

            return (
              <div key={step.key} className="flex items-center gap-3 text-sm">
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${
                  isCompleted ? "bg-success border-success text-white" :
                  isCurrent ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground"
                }`}>
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                </div>
                <span className={isCurrent ? "font-medium text-foreground" : "text-muted-foreground"}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border rounded-md overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-xs font-mono text-muted-foreground"
            aria-expanded={showLogs}
          >
            <span className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5" />
              Simulations-Protokoll (n8n)
            </span>
            <span>{showLogs ? "▲" : "▼"}</span>
          </button>
          {showLogs && (
            <div className="p-3 bg-black/90 text-green-400 text-[11px] font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
              {generateSimulationLog(record).join("\n\n")}
            </div>
          )}
        </div>

        {record.workflow_status === "FAILED" && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => {
              if (!record.job_id) {
                toast.error("Fehler: job_id fehlt. Bitte Backend-Schema prüfen.");
                return;
              }
              retryMutation.mutate(record.job_id);
            }}
            disabled={retryMutation.isPending || !record.job_id}
          >
            {retryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Vorgang wiederholen
          </Button>
        )}

        {canOffboard && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background h-9 px-3 text-sm font-medium text-danger ring-offset-background transition-colors hover:bg-accent hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
              <UserMinus className="h-4 w-4" />
              Offboarden
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Zugriff widerrufen?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Dadurch wird der Verzeichniszugriff für {record.first_name} {record.last_name} widerrufen.
                Dies ist eine Soft-Delete-Operation und kein harter Löschvorgang.
              </p>
              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={offboardMutation.isPending}>
                  Abbrechen
                </Button>
                <Button variant="destructive" onClick={handleOffboardConfirm} disabled={offboardMutation.isPending}>
                  {offboardMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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