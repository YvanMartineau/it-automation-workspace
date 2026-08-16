/**
 * Filter bar and export controls for the audit log viewer.
 * Single-select native dropdowns populated from backend.
 * @module components/data-display/AuditLogToolbar
 */

import { useCallback, useMemo } from "react";
import { ChevronDown, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { useAuditLogFilterOptions } from "#/hooks/useAuditLogFilterOption";
import type { AuditLogFilters, AuditLog } from "#/types/audit-log";

const ACTION_LABELS: Record<string, string> = {
  "asset.created": "Asset erstellt",
  "asset.updated": "Asset aktualisiert",
  "asset.deleted": "Asset gelöscht",
  "asset.scanned": "Netzwerk-Scan",
  "onboarding.created": "Onboarding erstellt",
  "onboarding.updated": "Onboarding aktualisiert",
  "onboarding.retried": "Onboarding wiederholt",
  "user.login": "Anmeldung",
  "user.logout": "Abmeldung",
  "user.permission_changed": "Berechtigung geändert",
  "report.generated": "Bericht erstellt",
  "report.deleted": "Bericht gelöscht",
};

const RESOURCE_LABELS: Record<string, string> = {
  asset: "Asset",
  onboarding: "Onboarding",
  user: "Benutzer",
  report: "Bericht",
};

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

  const headers = ["Zeitstempel", "Akteur", "Aktion", "Ressource", "Ressourcen-ID"];
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) =>
      [
        row.timestamp,
        row.actor,
        row.action,
        row.targetType ?? "",
        row.targetId ?? "",
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
 * Styled native <select> with an inline Lucide icon.
 * No base64 data: URI — CSP-safe.
 */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  isLoading,
}: {
  readonly label: string;
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
  readonly options: readonly { value: string; label: string }[];
  readonly placeholder: string;
  readonly isLoading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={isLoading}
          className="flex h-9 w-full min-w-[180px] cursor-pointer appearance-none rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function AuditLogToolbar({
  filters,
  onFiltersChange,
  onReset,
  data,
}: AuditLogToolbarProps) {
  const { data: filterOptions, isLoading: filtersLoading } = useAuditLogFilterOptions();

  const update = useCallback(
    <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const actorOptions = useMemo(
    () => (filterOptions?.actors ?? []).map((a) => ({ value: a, label: a })),
    [filterOptions?.actors]
  );

  const actionOptions = useMemo(
    () =>
      (filterOptions?.actions ?? []).map((a) => ({
        value: a,
        label: ACTION_LABELS[a] ?? a,
      })),
    [filterOptions?.actions]
  );

  const resourceOptions = useMemo(
    () =>
      (filterOptions?.targetTypes ?? []).map((t) => ({
        value: t,
        label: RESOURCE_LABELS[t] ?? t,
      })),
    [filterOptions?.targetTypes]
  );

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="audit-start-date" className="text-xs font-medium text-muted-foreground">
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
            <label htmlFor="audit-end-date" className="text-xs font-medium text-muted-foreground">
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
            placeholder="Alle Akteure"
            value={filters.actor}
            onChange={(v) => update("actor", v)}
            options={actorOptions}
            isLoading={filtersLoading}
          />

          <FilterSelect
            label="Aktion"
            placeholder="Alle Aktionen"
            value={filters.action}
            onChange={(v) => update("action", v)}
            options={actionOptions}
            isLoading={filtersLoading}
          />

          <FilterSelect
            label="Ressource"
            placeholder="Alle Ressourcen"
            value={filters.resourceType}
            onChange={(v) => update("resourceType", v)}
            options={resourceOptions}
            isLoading={filtersLoading}
          />
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