/**
 * Filter bar and export controls for the audit log viewer.
 * Uses native <select> to avoid Base UI focus-loop freezes.
 * @module components/data-display/AuditLogToolbar
 */

import { useCallback } from "react";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
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

/**
 * Styled native select that visually matches shadcn/Base UI SelectTrigger.
 */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full min-w-[160px] cursor-pointer appearance-none rounded-md border border-input bg-transparent bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Im02IDkgNiA2IDYtNiIvPjwvc3ZnPg==')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat px-3 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AuditLogToolbar({
  filters,
  onFiltersChange,
  onReset,
  data,
}: AuditLogToolbarProps) {
  const update = useCallback(
    <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div className="space-y-1.5">
            <label
              htmlFor="audit-start-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Von
            </label>
            <input
              id="audit-start-date"
              type="date"
              value={filters.startDate ?? ""}
              onChange={(e) => update("startDate", e.target.value || undefined)}
              className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="audit-end-date"
              className="text-xs font-medium text-muted-foreground"
            >
              Bis
            </label>
            <input
              id="audit-end-date"
              type="date"
              value={filters.endDate ?? ""}
              onChange={(e) => update("endDate", e.target.value || undefined)}
              className="flex h-9 w-[150px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            />
          </div>

          <FilterSelect
            label="Akteur"
            value={filters.actor ?? "all"}
            onChange={(value) => update("actor", value === "all" ? undefined : value)}
            options={[{ value: "all", label: "Alle Akteure" }, ...MOCK_ACTORS.map((a) => ({ value: a, label: a }))]}
          />

          <FilterSelect
            label="Aktion"
            value={filters.action}
            onChange={(value) => update("action", value as AuditAction | "all")}
            options={ACTION_OPTIONS}
          />

          <FilterSelect
            label="Ressource"
            value={filters.resourceType}
            onChange={(value) => update("resourceType", value as ResourceType | "all")}
            options={RESOURCE_OPTIONS}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Zurücksetzen
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(data)}
            className="gap-2"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            CSV Export
          </Button>
        </div>
      </div>
    </div>
  );
}