import { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Download,
  Trash2,
  Columns3,
  FileText,
  FileSpreadsheet,
  FileJson,
  ScanLine,
} from "lucide-react";
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
import { ScanDialog } from "#/components/feedback/ScanDialog";
import { useScanSimulation } from "#/hooks/useScanSimulation";
import type { Table as TanStackTable } from "@tanstack/react-table";
import type { Asset, AssetFilters, AssetStatus, OSType, AssetHealth } from "#/types/asset";

interface AssetToolbarProps {
  table: TanStackTable<Asset>;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  /** Called when the simulated scan completes with the number of discovered assets. */
  onScanComplete?: (foundCount: number) => void;
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

const NON_HIDEABLE_COLUMN_IDS = new Set(["select", "actions"]);

export function AssetToolbar({
  table,
  filters,
  onFiltersChange,
  selectedCount,
  onBulkDelete,
  onScanComplete,
}: AssetToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const { state: scanState, startScan, cancelScan } = useScanSimulation();

  const updateFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Auto-close dialog and notify parent when scan finishes
  useEffect(() => {
    if (scanState.status === "complete") {
      const timer = setTimeout(() => {
        setScanOpen(false);
        if (scanState.hostsFound > 0) {
          toast.success("Scan abgeschlossen", {
            description: `${scanState.hostsFound} neue Assets wurden entdeckt.`,
          });
        } else {
          toast.info("Scan abgeschlossen", {
            description: "Keine neuen Assets im Netzwerk gefunden.",
          });
        }
        onScanComplete?.(scanState.hostsFound);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [scanState.status, scanState.hostsFound, onScanComplete]);

  const handleStartScan = useCallback(() => {
    setScanOpen(true);
    startScan();
  }, [startScan]);

  const handleScanOpenChange = useCallback(
    (open: boolean) => {
      if (!open && scanState.isScanning) {
        cancelScan();
      }
      setScanOpen(open);
    },
    [scanState.isScanning, cancelScan]
  );

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

          {/* Column visibility */}
          <DropdownMenu>
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

          {/* Export */}
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

          {/* Network Scan (replaces "Asset hinzufügen") */}
          <Button
            size="sm"
            className="gap-2"
            onClick={handleStartScan}
            disabled={scanState.isScanning}
          >
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            {scanState.isScanning ? "Scan läuft…" : "Netzwerk-Scan"}
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

      {/* Scan Dialog */}
      <ScanDialog
        open={scanOpen}
        onOpenChange={handleScanOpenChange}
        scanState={scanState}
        onCancel={cancelScan}
      />
    </div>
  );
}