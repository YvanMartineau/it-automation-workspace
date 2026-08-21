import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { reportTriggerSchema, ReportTriggerInput, reportTypeLabels, ReportType } from "#/types/report";
import { useTriggerReport, useReportJobStatus, useDownloadReport } from "#/hooks/useReports";
import { Loader2, Download, CheckCircle2, AlertTriangle } from "lucide-react";

interface GenerateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({ open, onOpenChange }) => {
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuen PDF-Bericht anfordern</DialogTitle>
          <DialogDescription>
            Wählen Sie den Berichtstyp und den Zeitraum für die Auswertung.
          </DialogDescription>
        </DialogHeader>

        {!activeJobId ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report_type">Berichtstyp</Label>
              <Select onValueChange={(val) => setValue("report_type", val as ReportType)}>
                <SelectTrigger id="report_type">
                  <SelectValue placeholder="Typ auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.report_type && (
                <p className="text-xs text-destructive">{errors.report_type.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Startdatum</Label>
                <Input id="start_date" type="date" {...register("start_date")} />
                {errors.start_date && (
                  <p className="text-xs text-destructive">{errors.start_date.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Enddatum</Label>
                <Input id="end_date" type="date" {...register("end_date")} />
                {errors.end_date && (
                  <p className="text-xs text-destructive">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isTriggering}>
                {isTriggering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Bericht Erstellen
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-6 py-6 text-center">
            {(!jobStatus || jobStatus.status === "queued" || jobStatus.status === "running") && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Bericht wird im Hintergrund generiert...</p>
                <p className="text-xs text-muted-foreground">Status: {jobStatus?.status || "queued"}</p>
              </div>
            )}

            {jobStatus?.status === "completed" && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium">Bericht wurde erfolgreich erstellt!</p>
                <Button onClick={handleDownload} disabled={isDownloading} className="mt-2 w-full">
                  {isDownloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Jetzt Herunterladen (Einmalig)
                </Button>
              </div>
            )}

            {jobStatus?.status === "failed" && (
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm font-medium text-destructive">
                  Erstellung fehlgeschlagen: {jobStatus.error_message || "Unbekannter Fehler"}
                </p>
                <Button variant="outline" onClick={() => setActiveJobId(null)} className="mt-2">
                  Erneut versuchen
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};