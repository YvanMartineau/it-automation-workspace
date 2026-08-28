// frontend/src/components/feedback/ScanDialog.tsx — Premium Edition
import { ScanLine, Minimize2, Activity, Server, CheckCircle2, AlertTriangle, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { ScanState } from "#/hooks/useScanStream";

interface ScanDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly scanState: ScanState;
  readonly onMinimize: () => void;
  readonly onRetry?: () => void;
}

export function ScanDialog({ open, onOpenChange, scanState, onMinimize, onRetry }: ScanDialogProps) {
  const { progress, hostsScanned, hostsFound, totalHosts, currentHost, status, errorMessage } = scanState;

  const isScanning = status === "scanning" || status === "starting";
  const isComplete = status === "complete";
  const isError = status === "error";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl p-0 overflow-hidden" aria-describedby="scan-description">
        {/* Live region for screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isScanning && `Scanne ${currentHost}. ${hostsScanned} von ${totalHosts} gescannt.`}
          {isComplete && `Scan abgeschlossen. ${hostsFound ?? 0} Assets online gefunden.`}
          {isError && `Scan-Fehler: ${errorMessage}`}
        </div>

        {/* Header */}
        <div className={cn(
          "relative px-6 pt-6 pb-4 border-b",
          isComplete && "bg-gradient-to-br from-success/5 to-success/[0.02] border-success/10",
          isError && "bg-gradient-to-br from-danger/5 to-danger/[0.02] border-danger/10",
          isScanning && "bg-gradient-to-br from-primary/5 to-primary/[0.02] border-primary/10"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
              isComplete && "bg-success/10 text-success ring-success/20",
              isError && "bg-danger/10 text-danger ring-danger/20",
              isScanning && "bg-primary/10 text-primary ring-primary/20"
            )}>
              {isComplete && <CheckCircle2 className="h-5 w-5" />}
              {isError && <AlertTriangle className="h-5 w-5" />}
              {isScanning && <ScanLine className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {isComplete && "Scan abgeschlossen"}
                {isError && "Scan fehlgeschlagen"}
                {isScanning && "Netzwerk-Scan läuft"}
              </DialogTitle>
              <DialogDescription id="scan-description" className="text-xs text-muted-foreground/60 mt-0.5">
                {isComplete && `${hostsFound ?? 0} Assets online im Netzwerk gefunden.`}
                {isError && errorMessage}
                {isScanning && "Das System durchsucht das Netzwerk nach neuen Geräten. Bitte warten…"}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {!isError && (
            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground/70 text-xs font-medium uppercase tracking-wider">Fortschritt</span>
                  <span className="font-bold tabular-nums text-sm">{progress}%</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Scan-Fortschritt"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-150 ease-out",
                      isComplete ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon={<Server className="h-4 w-4 text-muted-foreground/50" />}
                  value={hostsScanned}
                  label="Gescannt"
                  color="muted"
                />
                <StatCard
                  icon={<Wifi className="h-4 w-4 text-success" />}
                  value={hostsFound ?? "–"}
                  label="Online"
                  color="success"
                />
                <StatCard
                  icon={<Activity className="h-4 w-4 text-muted-foreground/50" />}
                  value={totalHosts}
                  label="Gesamt"
                  color="muted"
                />
              </div>

              {/* Current Host */}
              {isScanning && currentHost && (
                <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  <div className="flex flex-1 items-center justify-between gap-3 text-sm min-w-0">
                    <span className="text-muted-foreground/60 text-xs font-medium shrink-0">Aktueller Host</span>
                    <span className="font-mono font-semibold text-xs tabular-nums text-foreground/80 truncate">{currentHost}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15">
                <AlertTriangle className="h-7 w-7 text-danger" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-danger">Scan konnte nicht durchgeführt werden</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 px-6 pb-6">
          {isScanning && (
            <Button variant="outline" onClick={onMinimize} className="gap-2 rounded-xl">
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
              Im Hintergrund weiterlaufen lassen
            </Button>
          )}
          {isError && onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2 rounded-xl">
              <ScanLine className="h-4 w-4" aria-hidden="true" />
              Erneut versuchen
            </Button>
          )}
          {(isComplete || isError) && (
            <Button onClick={() => onOpenChange(false)} className="gap-2 rounded-xl">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Schließen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Stat Card Sub-component
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: "muted" | "success" | "primary" | "danger";
}

function StatCard({ icon, value, label, color }: StatCardProps): JSX.Element {
  const colorMap = {
    muted: { bg: "bg-muted/40", text: "text-muted-foreground", ring: "ring-border" },
    success: { bg: "bg-success/8", text: "text-success", ring: "ring-success/15" },
    primary: { bg: "bg-primary/8", text: "text-primary", ring: "ring-primary/15" },
    danger: { bg: "bg-danger/8", text: "text-danger", ring: "ring-danger/15" },
  };

  const c = colorMap[color];

  return (
    <div className={cn("flex flex-col items-center gap-1.5 rounded-xl border border-border/50 bg-card p-3", "ring-1", c.ring)}>
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", c.bg)}>
        {icon}
      </div>
      <div className={cn("text-xl font-bold tabular-nums tracking-tight", c.text)}>{value}</div>
      <div className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">{label}</div>
    </div>
  );
}

