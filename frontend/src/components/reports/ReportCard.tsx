// src/components/reports/ReportCard.tsx — Premium Edition
import { FileText, Download, Eye, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "#/components/ui/card";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { reportTypeLabels } from "#/types/report";
import { cn } from "#/lib/utils";

type ReportStatus = "completed" | "processing" | "failed";

type Report = {
  id?: string;
  title: string;
  type?: string;
  status: ReportStatus;
  generatedAt: string | Date;
  fileSizeBytes?: number;
  generatedBy: string;
  downloadUrl?: string;
};

interface ReportCardProps {
  report: Report;
  onPreview: (report: Report) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "–";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status }: { status: Report["status"] }): JSX.Element {
  const config: Partial<Record<Report["status"], { gradient: string; icon: JSX.Element; badgeClass: string; label: string }>> = {
    completed: {
      gradient: "from-success/60 to-success/15",
      icon: <CheckCircle2 className="h-3 w-3" />,
      badgeClass: "bg-success/8 text-success border-success/20",
      label: "Fertig",
    },
    processing: {
      gradient: "from-primary/60 to-primary/15",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      badgeClass: "bg-primary/8 text-primary border-primary/20",
      label: "In Arbeit",
    },
    failed: {
      gradient: "from-danger/60 to-danger/15",
      icon: <AlertTriangle className="h-3 w-3" />,
      badgeClass: "bg-danger/8 text-danger border-danger/20",
      label: "Fehlgeschlagen",
    },
  };

  const c = config[status] ?? config.processing ?? {
    gradient: "from-primary/60 to-primary/15",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    badgeClass: "bg-primary/8 text-primary border-primary/20",
    label: "In Arbeit",
  };

  return (
    <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border gap-1", c.badgeClass)}>
      {c.icon}
      {c.label}
    </Badge>
  );
}

export function ReportCard({ report, onPreview }: ReportCardProps): JSX.Element {
  const reportTypeLabel =
    report.type && reportTypeLabels[report.type as keyof typeof reportTypeLabels]
      ? reportTypeLabels[report.type as keyof typeof reportTypeLabels]
      : String(report.type ?? "unknown");

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/60",
        "shadow-sm transition-all duration-300 ease-premium",
        "hover:shadow-card-hover hover:-translate-y-0.5"
      )}
    >
      {/* Gradient accent */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b",
          report.status === "completed" && "from-success/80 to-success/20",
          report.status === "processing" && "from-primary/80 to-primary/20",
          report.status === "failed" && "from-danger/80 to-danger/20"
        )}
        aria-hidden="true"
      />

      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                "bg-gradient-to-br",
                report.status === "completed" && "from-success/12 to-success/4",
                report.status === "processing" && "from-primary/12 to-primary/4",
                report.status === "failed" && "from-danger/12 to-danger/4",
                "ring-1 ring-foreground/5"
              )}
            >
              <FileText
                className={cn(
                  "h-5 w-5",
                  report.status === "completed" && "text-success",
                  report.status === "processing" && "text-primary",
                  report.status === "failed" && "text-danger"
                )}
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground/90 truncate">{report.title}</h4>
              <p className="text-[11px] text-muted-foreground/50 mt-0.5">{reportTypeLabel}</p>
            </div>
          </div>
          <StatusBadge status={report.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5 px-4 pb-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/50 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Erstellt
          </span>
          <span className="font-medium tabular-nums text-foreground/80">
            {new Date(report.generatedAt).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/50">Größe</span>
          <span className="font-medium tabular-nums text-foreground/80">{formatBytes(report.fileSizeBytes)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground/50">Erstellt von</span>
          <span className="font-medium text-foreground/80">{report.generatedBy}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4 pb-4 px-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-xl h-9 gap-2 border-border/60"
          disabled={report.status !== "completed"}
          onClick={() => onPreview(report)}
        >
          <Eye className="h-3.5 w-3.5" />
          Vorschau
        </Button>
        {report.status === "completed" && report.downloadUrl ? (
          <a
            href={report.downloadUrl}
            download
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl h-9 px-3",
              "bg-primary text-primary-foreground text-sm font-medium",
              "shadow-sm hover:bg-primary/90 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        ) : (
          <Button size="sm" className="flex-1 rounded-xl h-9 gap-2" disabled>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}