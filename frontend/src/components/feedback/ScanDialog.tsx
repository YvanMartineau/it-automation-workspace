import { ScanLine, X, Activity, Server, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import type { ScanState } from "#/hooks/useScanSimulation";

interface ScanDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly scanState: ScanState;
  readonly onCancel: () => void;
}

export function ScanDialog({
  open,
  onOpenChange,
  scanState,
  onCancel,
}: ScanDialogProps) {
  const { isScanning, progress, hostsScanned, hostsFound, totalHosts, currentHost, status } =
    scanState;

  const isComplete = status === "complete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="scan-description">
        {/* Screen-reader live region for progress announcements (WCAG) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isScanning &&
            `Scanne ${currentHost}. ${hostsScanned} von ${totalHosts} gescannt. ${hostsFound} Assets gefunden.`}
          {isComplete && `Scan abgeschlossen. ${hostsFound} neue Assets entdeckt.`}
        </div>

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            ) : (
              <ScanLine className="h-5 w-5 text-primary" aria-hidden="true" />
            )}
            {isComplete ? "Scan abgeschlossen" : "Netzwerk-Scan läuft"}
          </DialogTitle>
          <DialogDescription id="scan-description">
            {isComplete
              ? `${hostsFound} neue Assets wurden im Netzwerk entdeckt.`
              : "Das System durchsucht das lokale Netzwerk nach neuen Geräten. Bitte warten…"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fortschritt</span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Scan-Fortschritt"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-3 text-center">
              <Server className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="text-lg font-semibold tabular-nums">{hostsScanned}</div>
              <div className="text-xs text-muted-foreground">Gescannt</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Activity className="mx-auto mb-1 h-4 w-4 text-success" aria-hidden="true" />
              <div className="text-lg font-semibold tabular-nums text-success">{hostsFound}</div>
              <div className="text-xs text-muted-foreground">Gefunden</div>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Server className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <div className="text-lg font-semibold tabular-nums">{totalHosts}</div>
              <div className="text-xs text-muted-foreground">Gesamt</div>
            </div>
          </div>

          {/* Current host indicator */}
          {isScanning && currentHost && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              <div className="flex flex-1 items-center justify-between text-sm">
                <span className="text-muted-foreground">Aktueller Host:</span>
                <span className="font-mono font-medium tabular-nums">{currentHost}</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {!isComplete && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={!isScanning}
              className="gap-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Abbrechen
            </Button>
          )}
          {isComplete && (
            <Button onClick={() => onOpenChange(false)} className="gap-2">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Schließen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}