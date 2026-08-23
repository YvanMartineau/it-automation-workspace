// src/components/reports/GenerateReportModal.tsx — Premium Edition (Clean)
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { reportTriggerSchema, ReportTriggerInput, reportTypeLabels, ReportType } from "#/types/report";
import { useTriggerReport, useReportJobStatus, useDownloadReport } from "#/hooks/useReports";
import { Loader2, Download, CheckCircle2, AlertTriangle, FileText, CalendarDays } from "lucide-react";

interface GenerateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateReportModal({ open, onOpenChange }: GenerateReportModalProps): JSX.Element {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { mutate: triggerReport, isPending: isTriggering } = useTriggerReport();
  const { data: jobStatus } = useReportJobStatus(activeJobId);
  const { mutate: downloadReport, isPending: isDownloading } = useDownloadReport();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ReportTriggerInput>({
    resolver: zodResolver(reportTriggerSchema),
    defaultValues: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = (data: ReportTriggerInput) => {
    triggerReport(data, {
      onSuccess: (res) => {
        setActiveJobId(res.job_id);
      },
    });
  };

  const handleClose = () => {
    setActiveJobId(null);
    reset();
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (activeJobId) {
      downloadReport(activeJobId, {
        onSuccess: () => {
          handleClose();
        },
      });
    }
  };

  const isJobActive = !!activeJobId;
  const normalizedStatus = String(jobStatus?.status ?? "queued").toLowerCase();
  const isQueued = normalizedStatus === "queued" || normalizedStatus === "running" || normalizedStatus === "pending" || !jobStatus;
  const isComplete = normalizedStatus === "completed" || normalizedStatus === "success" || normalizedStatus === "done" || normalizedStatus === "ready";
  const isFailed = normalizedStatus === "failed" || normalizedStatus === "error";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/5 to-primary/[0.02] px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Neuen PDF-Bericht anfordern</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground/60 mt-0.5">
                Wählen Sie den Berichtstyp und den Zeitraum für die Auswertung.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {!isJobActive ? (
            /* Form */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="report_type" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Berichtstyp
                </Label>
                <Select onValueChange={(val) => setValue("report_type", val as ReportType)}>
                  <SelectTrigger id="report_type" className="rounded-xl h-10 focus-visible:ring-primary/30">
                    <SelectValue placeholder="Typ auswählen" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(reportTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key} className="text-xs rounded-lg">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.report_type && (
                  <p className="text-[11px] text-destructive">{errors.report_type.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Startdatum
                  </Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      id="start_date"
                      type="date"
                      className="rounded-xl h-10 pl-10 focus-visible:ring-primary/30"
                      {...register("start_date")}
                    />
                  </div>
                  {errors.start_date && (
                    <p className="text-[11px] text-destructive">{errors.start_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Enddatum
                  </Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                    <Input
                      id="end_date"
                      type="date"
                      className="rounded-xl h-10 pl-10 focus-visible:ring-primary/30"
                      {...register("end_date")}
                    />
                  </div>
                  {errors.end_date && (
                    <p className="text-[11px] text-destructive">{errors.end_date.message}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl">
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isTriggering} className="rounded-xl gap-2">
                  {isTriggering && <Loader2 className="h-4 w-4 animate-spin" />}
                  Bericht Erstellen
                </Button>
              </DialogFooter>
            </form>
          ) : (
            /* Job Status */
            <div className="space-y-6 py-4">
              {isQueued && (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary/60" />
                    <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/10 blur-lg" aria-hidden="true" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground/90">Bericht wird generiert…</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Status: <span className="font-medium text-primary capitalize">{jobStatus?.status || "queued"}</span>
                    </p>
                  </div>
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
                    </div>
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/8 ring-1 ring-success/15">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground/90">Bericht erstellt!</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Der Bericht steht zum Download bereit.
                    </p>
                  </div>
                  <Button onClick={handleDownload} disabled={isDownloading} className="w-full rounded-xl gap-2 mt-2">
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Jetzt Herunterladen
                  </Button>
                </div>
              )}

              {isFailed && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15">
                    <AlertTriangle className="h-7 w-7 text-danger" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-danger">Erstellung fehlgeschlagen</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                      {jobStatus?.error_message || "Ein unbekannter Fehler ist aufgetreten."}
                    </p>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <Button variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
                      Schließen
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveJobId(null)}
                      className="flex-1 rounded-xl gap-2"
                    >
                      <Loader2 className="h-3.5 w-3.5" />
                      Erneut versuchen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
