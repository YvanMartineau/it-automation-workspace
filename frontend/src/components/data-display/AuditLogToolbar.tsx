/**
 * Filter bar and export controls for the audit log viewer.
 * Multi-select dropdowns using DropdownMenu (Base UI).
 * @module components/data-display/AuditLogToolbar
 */

import { useCallback, useMemo } from "react";
import { ChevronDown, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { AuditLogFilters, AuditAction, ResourceType, AuditLog } from "#/types/audit-log";
import { MOCK_ACTORS } from "#/hooks/useAuditLogs";

const ACTION_OPTIONS: readonly { value: AuditAction; label: string }[] = [
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

const RESOURCE_OPTIONS: readonly { value: ResourceType; label: string }[] = [
  { value: "asset", label: "Asset" },
  { value: "onboarding", label: "Onboarding" },
  { value: "user", label: "Benutzer" },
  { value: "report", label: "Bericht" },
];

const ACTOR_OPTIONS: readonly { value: string; label: string }[] = MOCK_ACTORS.map((a) => ({
  value: a,
  label: a,
}));

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

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  readonly label: string;
  readonly options: readonly { value: T; label: string }[];
  readonly selected: readonly T[] | undefined;
  readonly onChange: (selected: readonly T[]) => void;
  readonly placeholder: string;
}) {
  const values = selected ?? [];

  const toggle = useCallback(
    (value: T) => {
      onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
    },
    [values, onChange]
  );

  const display = useMemo(() => {
    if (values.length === 0) return placeholder;
    if (values.length === 1) {
      const first = values[0];
      if (first === undefined) return placeholder;
      return options.find((o) => o.value === first)?.label ?? placeholder;
    }
    return `${label} (${values.length})`;
  }, [values, options, label, placeholder]);

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" className="w-full min-w-[180px] justify-between gap-2">
              <span className="truncate">{display}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-56">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={values.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              onSelect={(e) => e.preventDefault()}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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

          <MultiSelectFilter
            label="Akteur"
            placeholder="Alle Akteure"
            options={ACTOR_OPTIONS}
            selected={filters.actors}
            onChange={(v) => update("actors", v)}
          />

          <MultiSelectFilter
            label="Aktion"
            placeholder="Alle Aktionen"
            options={ACTION_OPTIONS}
            selected={filters.actions}
            onChange={(v) => update("actions", v)}
          />

          <MultiSelectFilter
            label="Ressource"
            placeholder="Alle Ressourcen"
            options={RESOURCE_OPTIONS}
            selected={filters.resourceTypes}
            onChange={(v) => update("resourceTypes", v)}
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