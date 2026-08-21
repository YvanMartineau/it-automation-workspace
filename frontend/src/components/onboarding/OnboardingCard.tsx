// src/components/onboarding/OnboardingCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { CheckCircle2, Circle, XCircle, Loader2, Terminal } from "lucide-react";
import type { OnboardedUserListItem, OnboardingWorkflowStatus } from "#/types/onboarding";
import { useRetryOnboarding } from "#/hooks/useOnboarding";
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

// Dynamically generate mock n8n logs based on current job status
const generateSimulationLog = (record: OnboardedUserListItem): string[] => {
  const logs: string[] = [];
  const name = `${record.first_name} ${record.last_name}`;
  
  if (record.job_status !== "PENDING") {
    logs.push(`POST https://n8n.instance.com/webhook/onboard-start\nPayload: { "first_name": "${record.first_name}", "email": "${record.email}", "department": "${record.department}" }`);
  }
  if (["AD_CREATING", "EMAIL_SENDING", "JIRA_CREATING", "COMPLETED"].includes(record.job_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/ad-create\nPayload: { "user": "${name}", "ou": "${record.department}", "source": "${record.provisioning_source}" }`);
  }
  if (["EMAIL_SENDING", "JIRA_CREATING", "COMPLETED"].includes(record.job_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/email-send\nPayload: { "to": "${record.email}", "template": "welcome" }`);
  }
  if (["JIRA_CREATING", "COMPLETED"].includes(record.job_status)) {
    logs.push(`POST https://n8n.instance.com/webhook/jira-ticket\nPayload: { "summary": "IT Setup for ${name}", "priority": "High" }`);
  }
  if (record.job_status === "FAILED" && record.error_message) {
    logs.push(`\n❌ ERROR: ${record.error_message}`);
  }
  
  return logs;
};

interface OnboardingCardProps {
  record: OnboardedUserListItem;
}

export function OnboardingCard({ record }: OnboardingCardProps) {
  const retryMutation = useRetryOnboarding();
  const [showLogs, setShowLogs] = useState(false);
  const config = statusConfig[record.job_status];

  const currentStepIndex = STEPS.findIndex((s) => s.key === record.job_status);
  const displaySteps = record.job_status === "FAILED" ? STEPS : STEPS.slice(0, currentStepIndex + 1);

  return (
    <Card className="hover:shadow-md transition-shadow border-l-4 border-l-primary/50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-semibold">{record.first_name} {record.last_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{record.job_title} • {record.department}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{record.email}</p>
          </div>
          <Badge variant="outline" className={`${config.color} border-0 flex items-center gap-1.5`}>
            {config.icon}
            {record.job_status === "FAILED" ? "Fehlgeschlagen" : record.job_status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Vertical Step Indicator */}
        <div className="space-y-2">
          {displaySteps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex && record.job_status !== "FAILED";
            const isCurrent = idx === currentStepIndex && record.job_status !== "FAILED";
            
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

        {/* Simulation Log Panel */}
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

        {/* Retry Action */}
        {record.job_status === "FAILED" && (
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
      </CardContent>
    </Card>
  );
}