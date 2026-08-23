// src/pages/Reports.tsx — Premium Edition (Fixed Status Mapping)
import { useState } from "react";
import { Plus, History, FileText, CheckCircle2, Loader2, AlertTriangle, BarChart3 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Badge } from "#/components/ui/badge";
import { GenerateReportModal } from "#/components/reports/GenerateReportModal";
import { useReportHistory } from "#/hooks/useReports";
import { cn } from "#/lib/utils";

// ---------------------------------------------------------------------------
// Robust Status Badge — handles multiple backend status values
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string | null | undefined }): JSX.Element {
  const normalized = String(status ?? "").toLowerCase().trim();

  // Map various backend status values to display states
  const statusMap: Record<string, { class: string; icon: React.ReactNode; label: string }> = {
    completed: {
      class: "bg-success/8 text-success border-success/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Fertig",
    },
    success: {
      class: "bg-success/8 text-success border-success/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Fertig",
    },
    done: {
      class: "bg-success/8 text-success border-success/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Fertig",
    },
    ready: {
      class: "bg-success/8 text-success border-success/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Fertig",
    },
    processing: {
      class: "bg-primary/8 text-primary border-primary/20",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "In Arbeit",
    },
    running: {
      class: "bg-primary/8 text-primary border-primary/20",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "In Arbeit",
    },
    queued: {
      class: "bg-warning/8 text-warning border-warning/20",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Wartend",
    },
    pending: {
      class: "bg-warning/8 text-warning border-warning/20",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Wartend",
    },
    failed: {
      class: "bg-danger/8 text-danger border-danger/20",
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Fehlgeschlagen",
    },
    error: {
      class: "bg-danger/8 text-danger border-danger/20",
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Fehlgeschlagen",
    },
  };

  const c = statusMap[normalized] ?? {
    class: "bg-muted/60 text-muted-foreground border-muted",
    icon: <Loader2 className="h-3 w-3" />,
    label: normalized || "Unbekannt",
  };

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold border gap-1", c.class)}
    >
      {c.icon}
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Report Type Badge
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string | null | undefined }): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-md bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
      {type ?? "–"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stats Pill
// ---------------------------------------------------------------------------

interface StatPillProps {
  readonly label: string;
  readonly value: number;
  readonly icon: React.ReactNode;
  readonly color: "primary" | "success" | "warning" | "danger" | "muted";
}

function StatPill({ label, value, icon, color }: StatPillProps): JSX.Element {
  const colorMap = {
    primary: { bg: "bg-primary/6", text: "text-primary", iconBg: "bg-primary/10", ring: "ring-primary/15" },
    success: { bg: "bg-success/6", text: "text-success", iconBg: "bg-success/10", ring: "ring-success/15" },
    warning: { bg: "bg-warning/6", text: "text-warning", iconBg: "bg-warning/10", ring: "ring-warning/15" },
    danger: { bg: "bg-danger/6", text: "text-danger", iconBg: "bg-danger/10", ring: "ring-danger/15" },
    muted: { bg: "bg-muted/40", text: "text-muted-foreground", iconBg: "bg-muted", ring: "ring-border" },
  };

  const c = colorMap[color];

  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3 border border-border/60 bg-card shadow-sm")}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c.iconBg, "ring-1", c.ring)}>
        <span className={c.text}>{icon}</span>
      </div>
      <div>
        <p className={cn("text-lg font-bold tabular-nums tracking-tight leading-none", c.text)}>{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground/60 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReportsPage(): JSX.Element {
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const { data: history, isLoading, isError, refetch } = useReportHistory();

  const stats = {
    total: history?.length ?? 0,
    completed: history?.filter((h) => {
      const s = String(h.status ?? "").toLowerCase();
      return s === "completed" || s === "success" || s === "done" || s === "ready";
    }).length ?? 0,
    processing: history?.filter((h) => {
      const s = String(h.status ?? "").toLowerCase();
      return s === "processing" || s === "running" || s === "queued" || s === "pending";
    }).length ?? 0,
    failed: history?.filter((h) => {
      const s = String(h.status ?? "").toLowerCase();
      return s === "failed" || s === "error";
    }).length ?? 0,
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient sm:text-3xl">
            Report Gallery
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1.5 max-w-xl leading-relaxed">
            Generieren Sie individuelle PDF-Berichte und überprüfen Sie das Versandprotokoll.
          </p>
        </div>
        <Button onClick={() => setIsGenerateOpen(true)} className="gap-2 rounded-xl px-5 shadow-sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neuen Bericht Anfordern
        </Button>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Berichts-Statistiken">
        <StatPill label="Gesamt" value={stats.total} icon={<FileText className="h-4 w-4" />} color="primary" />
        <StatPill label="Fertig" value={stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} color="success" />
        <StatPill label="In Arbeit" value={stats.processing} icon={<Loader2 className="h-4 w-4" />} color="warning" />
        <StatPill label="Fehlgeschlagen" value={stats.failed} icon={<AlertTriangle className="h-4 w-4" />} color={stats.failed > 0 ? "danger" : "muted"} />
      </section>

      {/* History Table */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Berichts-Historie</CardTitle>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              {stats.total} {stats.total === 1 ? "Eintrag" : "Einträge"} in der Historie
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="space-y-3 px-6 pb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/8 ring-1 ring-danger/15 mb-4">
                <AlertTriangle className="h-6 w-6 text-danger" />
              </div>
              <h3 className="text-sm font-semibold text-foreground/90">Fehler beim Laden</h3>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Die Berichts-Historie konnte nicht geladen werden.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4 rounded-xl gap-2">
                <Loader2 className="h-3.5 w-3.5" />
                Erneut versuchen
              </Button>
            </div>
          ) : history && history.length > 0 ? (
            <div className="w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/60">
                    <TableHead className="w-[200px]">Berichtsname</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Ausgelöst von</TableHead>
                    <TableHead>Empfänger</TableHead>
                    <TableHead>Gesendet am</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow
                      key={item.id}
                      className="group transition-colors hover:bg-accent/20 border-b border-border/30"
                    >
                      <TableCell className="font-semibold text-sm text-foreground/90">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/8 ring-1 ring-primary/15">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="truncate">{item.report_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={item.report_type} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground/80">{item.triggered_by}</TableCell>
                      <TableCell className="text-xs text-muted-foreground/60 font-mono truncate max-w-[180px]">
                        {item.recipient_email}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs text-muted-foreground/60">
                        {new Date(item.sent_at).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50 mb-4">
                <FileText className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-semibold text-foreground/80">Keine Berichte</h3>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                Noch keine Berichte in der Historie. Erstellen Sie Ihren ersten Bericht.
              </p>
              <Button onClick={() => setIsGenerateOpen(true)} className="mt-4 rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Ersten Bericht erstellen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <GenerateReportModal open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
    </div>
  );
}
