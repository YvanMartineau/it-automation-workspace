import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "#/components/ui/dialog";
import { Report } from "#/types/report";

interface ReportPreviewModalProps {
  report: Report | null;
  onClose: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ report, onClose }) => {
  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vorschau: {report?.title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full bg-muted/20 rounded-md overflow-hidden border">
          {report?.downloadUrl ? (
            <iframe
              src={report.downloadUrl}
              className="w-full h-full"
              title={`Vorschau von ${report.title}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Keine Vorschau verfügbar.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};