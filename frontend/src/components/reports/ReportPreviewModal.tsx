// src/components/reports/ReportPreviewModal.tsx — Premium Edition
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { FileText } from "lucide-react";

type ReportPreview = {
  title?: string;
  downloadUrl?: string | null;
};

interface ReportPreviewModalProps {
  report: ReportPreview | null;
  onClose: () => void;
}

export function ReportPreviewModal({ report, onClose }: ReportPreviewModalProps): JSX.Element {
  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/40 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold">{report?.title}</DialogTitle>
          </DialogHeader>
        </div>

        {/* Preview */}
        <div className="flex-1 w-full h-full bg-muted/20 overflow-hidden">
          {report?.downloadUrl ? (
            <iframe
              src={report.downloadUrl}
              className="w-full h-full border-0"
              title={`Vorschau von ${report.title}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/60 text-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                  <FileText className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p>Keine Vorschau verfügbar.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
