//frontend/src/components/data-display/AssetToolbar.tsx
import { useState } from "react";
import { Filter, Plus, Download, Trash2, Columns3, FileText, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { SearchInput } from "#/components/forms/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { Table as TanStackTable } from "@tanstack/react-table";
import type { Asset, AssetFilters, AssetStatus, OSType, AssetHealth } from "#/types/asset";

interface AssetToolbarProps {
  table: TanStackTable<Asset>;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  selectedCount: number;
  onBulkDelete: () => void;
}

const STATUS_OPTIONS: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "sleeping", label: "Schlafend" },
];

const OS_OPTIONS: { value: OSType | "all"; label: string }[] = [
  { value: "all", label: "Alle OS" },
  { value: "Windows", label: "Windows" },
  { value: "Linux", label: "Linux" },
  { value: "macOS", label: "macOS" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
  { value: "Other", label: "Sonstige" },
];

const HEALTH_OPTIONS: { value: AssetHealth | "all"; label: string }[] = [
  { value: "all", label: "Alle Health" },
  { value: "healthy", label: "Gesund (≥80%)" },
  { value: "warning", label: "Warnung (50-79%)" },
  { value: "critical", label: "Kritisch (<50%)" },
  { value: "unknown", label: "Unbekannt" },
];

// Columns nobody should be able to hide via the toggle — selection checkbox
// and row actions are structural, not data fields.
const NON_HIDEABLE_COLUMN_IDS = new Set(["select", "actions"]);

export function AssetToolbar({
  table,
  filters,
  onFiltersChange,
  selectedCount,
  onBulkDelete,
}: AssetToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // TODO: no export endpoint exists yet (lib/api.ts is still in progress and
  // doesn't have one). Wired to a placeholder toast for now so the UI is
  // functional and the format choices are settled; swap the toast for a real
  // request (e.g. GET /assets/export?format=csv&...filters) once the backend
  // route exists. Flagged in chat rather than guessing at the endpoint shape.
  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    toast.info(`Export als ${format.toUpperCase()} wird vorbereitet…`, {
      description: "Backend-Export-Endpoint ist noch nicht angebunden.",
    });
  };

  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && !NON_HIDEABLE_COLUMN_IDS.has(column.id));

  return (
    <div className="space-y-4">
      {/* Primary toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <SearchInput
            value={filters.search}
            onChange={(value) => updateFilter("search", value)}
            placeholder="Hostname, IP, MAC suchen..."
            className="max-w-sm"
            ariaLabel="Asset-Suche"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filter
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {selectedCount} löschen
            </Button>
          )}

          {/* Column visibility ("display fields on choice") */}
          <DropdownMenu>
            {/* CORRECTION: Base UI has no `asChild` (that's a Radix pattern
                I wrongly assumed applied here). Composition works via a
                `render` prop instead — matches how this project's own
                select.tsx does it (SelectPrimitive.Icon render={<... />}). */}
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Columns3 className="h-4 w-4" aria-hidden="true" />
                  Anzeige
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Spalten anzeigen</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((column) => {
                  const header = column.columnDef.header;
                  const label = typeof header === "string" ? header : column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export — was previously a plain Button with no menu at all */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Export
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                Als Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
                <FileJson className="h-4 w-4" aria-hidden="true" />
                Als PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Asset hinzufügen
          </Button>
        </div>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter("status", value as AssetStatus | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.os}
            onValueChange={(value) => updateFilter("os", value as OSType | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Betriebssystem" />
            </SelectTrigger>
            <SelectContent>
              {OS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.health}
            onValueChange={(value) => updateFilter("health", value as AssetHealth | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}