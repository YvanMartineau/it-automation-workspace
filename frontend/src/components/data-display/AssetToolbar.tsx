//frontend/src/components/data-display/AssetToolbar.tsx
import { useState } from "react";
import { Filter, Plus, Download, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { SearchInput } from "#/components/forms/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import type { AssetFilters, AssetStatus, OSType, AssetHealth } from "#/types/asset";

interface AssetToolbarProps {
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  selectedCount: number;
  onBulkDelete: () => void;
}

const STATUS_OPTIONS: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "maintenance", label: "Wartung" },
  { value: "decommissioned", label: "Außer Betrieb" },
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

export function AssetToolbar({
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
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </Button>
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
