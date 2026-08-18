import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "#/components/ui/dialog";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { generateReportSchema, GenerateReportInput, reportTypeLabels, ReportType } from "#/types/report";
import { useGenerateReport } from "#/hooks/useReports";
import { Loader2 } from "lucide-react";

interface GenerateReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({ open, onOpenChange }) => {
  const { mutate: generateReport, isPending } = useGenerateReport();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GenerateReportInput>({
    resolver: zodResolver(generateReportSchema),
    defaultValues: {
      title: "",
      dateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
      },
    },
  });

  const onSubmit = (data: GenerateReportInput) => {
    generateReport(data, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Neuen Bericht erstellen</DialogTitle>
          <DialogDescription>
            Wählen Sie den Berichtstyp und den Datumsbereich für die Analyse aus.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Berichtstitel</Label>
            <Input id="title" placeholder="z. B. Q3 IT-Systembericht" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Berichtstyp</Label>
            <Select onValueChange={(val) => setValue("type", val as ReportType)}>
              <SelectTrigger id="type">
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
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum</Label>
              <Input id="startDate" type="date" {...register("dateRange.startDate")} />
              {errors.dateRange?.startDate && (
                <p className="text-xs text-destructive">{errors.dateRange.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Enddatum</Label>
              <Input id="endDate" type="date" {...register("dateRange.endDate")} />
              {errors.dateRange?.endDate && (
                <p className="text-xs text-destructive">{errors.dateRange.endDate.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generieren
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};