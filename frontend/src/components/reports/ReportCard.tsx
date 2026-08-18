import React from "react";
import { FileText, Download, Eye, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Report, reportTypeLabels } from "#/types/report";

interface ReportCardProps {
  report: Report;
  onPreview: (report: Report) => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({ report, onPreview }) => {
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "N/A";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <Card className="flex flex-col justify-between transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold tracking-tight">{report.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{reportTypeLabels[report.type]}</p>
            </div>
          </div>
          {report.status === "completed" && (
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Fertig
            </Badge>
          )}
          {report.status === "processing" && (
            <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              In Arbeit
            </Badge>
          )}
          {report.status === "failed" && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Fehlgeschlagen
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Erstellt am:
          </span>
          <span className="font-medium tabular-nums text-foreground">
            {new Date(report.generatedAt).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Dateigröße:</span>
          <span className="font-medium tabular-nums text-foreground">{formatBytes(report.fileSizeBytes)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Erstellt von:</span>
          <span className="font-medium text-foreground">{report.generatedBy}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={report.status !== "completed"}
          onClick={() => onPreview(report)}
          aria-label={`Vorschau für ${report.title}`}
        >
          <Eye className="mr-2 h-4 w-4" />
          Vorschau
        </Button>
        {report.status === "completed" && report.downloadUrl ? (
          <a
            href={report.downloadUrl}
            download
            aria-label={`Bericht ${report.title} herunterladen`}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        ) : (
          <Button size="sm" className="w-full" disabled={report.status !== "completed" || !report.downloadUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};