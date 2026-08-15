/**
 * Filter bar and export controls for the audit log viewer.
 * @module components/data-display/AuditLogToolbar
 */

import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import type { AuditLogFilters, AuditAction, ResourceType, AuditLog } from "#/types/audit-log";
import { MOCK_ACTORS } from "#/hooks/useAuditLogs";

const ACTION_OPTIONS: { value: AuditAction | "all"; label: string }[] = [
  { value: "all", label: "Alle Aktionen" },
  { value: "asset.created", label: "Asset erstellt" },
  { value: "asset.updated", label: "Asset aktualisiert" },
  { value: "asset.deleted", label: "Asset gelöscht" },
  { value: "asset.scanned", label: "Netzwerk-Scan" },
  { value: "onboarding.created", label: "Onboarding erstellt" },
  { value: "onboarding.updated", label: "Onboarding aktualisiert" },
  { value: "onboarding.retried", label: "Onboarding wiederholt" },
  { value: "user.login", label: "Anmeldung" },
  { value: "user.logout", label: "Abmeldung" },
  { value: "user.permission_changed", label: "Berechtigung geändert" },
  { value: "report.generated", label: "Bericht erstellt" },
  { value: "report.deleted", label: "Bericht gelöscht" },
];

const RESOURCE_OPTIONS: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "Alle Ressourcen" },
  { value: "asset", label: "Asset" },
  { value: "onboarding", label: "Onboarding" },
  { value: "user", label: "Benutzer" },
  { value: "report", label: "Bericht" },
];

interface AuditLogToolbarProps {
  readonly filters: AuditLogFilters;
  readonly onFiltersChange: (filters: AuditLogFilters) => void;
  readonly onReset: () => void;
  readonly data: readonly AuditLog[];
}

function downloadCsv(rows: readonly AuditLog[]) {
  if (rows.length === 0) {
    toast.error("Keine Daten zum Exportieren vorhanden.");
    return;
  }

  const headers = ["Zeitstempel", "Akteur", "Aktion", "Ressource", "Ressourcen-ID", "IP-Adresse"];
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) =>
      [
        row.timestamp,
        row.actor,
        row.action,
        row.resourceType,
        row.resourceId,
        row.ipAddress ?? "",
      ].join(";")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `audit-log_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  toast.success("CSV-Export heruntergeladen");
}

export function AuditLogToolbar({
  filters,
  onFiltersChange,
  onReset,
  data,
}: AuditLogToolbarProps) {
  const update = <K extends keyof AuditLogFilters>(
    key: K,
    value: AuditLogFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div className="space-y-1.5">
            <label htmlFor="audit-start-date" className="text-xs font-medium text-muted-foreground">
              Von
            </label>
            <input
              id="audit-start-date"
              type="date"
              value={filters.startDate ?? ""}
              onChange={(e) => update("startDate", e.target.value || undefined)}
              className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="audit-end-date" className="text-xs font-medium text-muted-foreground">
              Bis
            </label>
            <input
              id="audit-end-date"
              type="date"
              value={filters.endDate ?? ""}
              onChange={(e) => update("endDate", e.target.value || undefined)}
              className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Actor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Akteur</label>
            <Select
              value={filters.actor ?? "all"}
              onValueChange={(value) =>
                update("actor", value && value !== "all" ? value : undefined)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Akteur auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Akteure</SelectItem>
                {MOCK_ACTORS.map((actor) => (
                  <SelectItem key={actor} value={actor}>
                    {actor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Aktion</label>
            <Select
              value={filters.action}
              onValueChange={(value) =>
                update(
                  "action",
                  (value && value !== "all" ? value : "all") as AuditAction | "all"
                )
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Aktion auswählen" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resource Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ressource</label>
            <Select
              value={filters.resourceType}
              onValueChange={(value) =>
                update(
                  "resourceType",
                  (value && value !== "all" ? value : "all") as ResourceType | "all"
                )
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Ressource auswählen" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Zurücksetzen
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(data)} className="gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV Export
          </Button>
        </div>
      </div>
    </div>
  );
}