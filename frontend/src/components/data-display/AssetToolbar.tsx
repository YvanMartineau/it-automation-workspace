// frontend/src/components/data-display/AssetToolbar.tsx
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
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
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
import { useScanStream } from "#/hooks/useScanStream";
import { useAuthStore } from "#/hooks/useAuth";
import { scanRequestSchema } from "#/types/scan";
import { cn } from "#/lib/utils";
import type { Table as TanStackTable } from "@tanstack/react-table";
import type { Asset, AssetFilters, DeviceStatus, AssetHealth } from "#/types/asset";

const DEFAULT_SCAN_SUBNET = "192.168.179.0/24";

interface AssetToolbarProps {
  table: TanStackTable<Asset>;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  onScanComplete?: (foundCount: number) => void;
}

const STATUS_OPTIONS: { value: DeviceStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "unknown", label: "Unbekannt" },
];

const OS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle OS" },
  { value: "Windows", label: "Windows" },
  { value: "Linux", label: "Linux" },
  { value: "Mac", label: "macOS" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
];

const HEALTH_OPTIONS: { value: AssetHealth | "all"; label: string }[] = [
  { value: "all", label: "Alle Health" },
  { value: "healthy", label: "Gesund" },
  { value: "warning", label: "Langsam" },
  { value: "critical", label: "Kritisch" },
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
  const [subnetInput, setSubnetInput] = useState(DEFAULT_SCAN_SUBNET);
  const [now, setNow] = useState(() => Date.now());

  const { state: scanState, startScan, dismissResult } = useScanStream();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = typeof role === "string" && role.toLowerCase() === "admin";

  if (import.meta.env.DEV && !isAdmin) {
    console.debug("[AssetToolbar] scan button hidden — current role:", role);
  }

  const updateFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  useEffect(() => {
    if (scanState.status === "complete") {
      const timer = setTimeout(() => {
        setScanOpen(false);
        const found = scanState.hostsFound ?? 0;
        if (found > 0) {
          toast.success("Scan abgeschlossen", {
            description: `${found} Assets online gefunden.`,
          });
        } else {
          toast.info("Scan abgeschlossen", {
            description: "Keine Assets online gefunden.",
          });
        }
        onScanComplete?.(found);
      }, 1500);
      return () => clearTimeout(timer);
    }
    if (scanState.status === "error" && scanState.errorMessage) {
      toast.error("Scan fehlgeschlagen", { description: scanState.errorMessage });
    }
  }, [scanState.status, scanState.hostsFound, scanState.errorMessage, onScanComplete]);

  useEffect(() => {
    if (!scanState.cooldownUntil || scanState.cooldownUntil <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [scanState.cooldownUntil]);

  const cooldownSecondsRemaining =
    scanState.cooldownUntil && scanState.cooldownUntil > now
      ? Math.ceil((scanState.cooldownUntil - now) / 1000)
      : 0;

  const handleScanButtonClick = useCallback(() => {
    if (scanState.status === "scanning" || scanState.status === "starting") {
      setScanOpen(true);
      return;
    }
    const parsed = scanRequestSchema.safeParse({ subnet: subnetInput });
    if (!parsed.success) {
      toast.error("Ungültiges Subnetz", {
        description: parsed.error.issues[0]?.message,
      });
      return;
    }
    setScanOpen(true);
    void startScan(parsed.data.subnet);
  }, [scanState.status, subnetInput, startScan]);

  const handleRetry = useCallback(() => {
    const parsed = scanRequestSchema.safeParse({ subnet: subnetInput });
    if (parsed.success) void startScan(parsed.data.subnet);
  }, [subnetInput, startScan]);

  const handleMinimize = useCallback(() => setScanOpen(false), []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setScanOpen(open);
      if (!open && (scanState.status === "complete" || scanState.status === "error")) {
        dismissResult();
      }
    },
    [scanState.status, dismissResult]
  );

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    toast.info(`Export als ${format.toUpperCase()} wird vorbereitet…`, {
      description: "Backend-Export-Endpoint ist noch nicht angebunden.",
    });
  };

  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && !NON_HIDEABLE_COLUMN_IDS.has(column.id));

  const isScanBusy = scanState.status === "scanning" || scanState.status === "starting";
  const scanDisabled = !isAdmin || cooldownSecondsRemaining > 0;

  const activeFilterCount = [
    filters.status !== "all",
    filters.os !== "all",
    filters.health !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Primary toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Search + Filter toggle */}
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
            <Input
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Hostname, IP, MAC suchen..."
              className="h-10 pl-10 pr-4 rounded-xl bg-card border-border/60 focus-visible:ring-primary/30"
              aria-label="Asset-Suche"
            />
            {filters.search && (
              <button
                onClick={() => updateFilter("search", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                aria-label="Suche löschen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "gap-2 rounded-xl h-10 px-4 border-border/60 transition-all duration-200",
              showFilters && "bg-accent border-accent text-accent-foreground"
            )}
            aria-expanded={showFilters}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filter
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="gap-2 rounded-xl h-9"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {selectedCount} löschen
            </Button>
          )}

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 px-3 border-border/60">
                  <Columns3 className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Anzeige</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Spalten anzeigen
                </DropdownMenuLabel>
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
                <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 px-3 border-border/60">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 rounded-lg">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2 rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Als Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 rounded-lg">
                <FileJson className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Als PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Network Scan — admin only */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Input
                value={subnetInput}
                onChange={(e) => setSubnetInput(e.target.value)}
                placeholder="192.168.1.0/24"
                aria-label="Subnetz für Netzwerk-Scan"
                className="w-40 h-9 rounded-xl bg-card border-border/60 text-xs font-mono focus-visible:ring-primary/30"
                disabled={isScanBusy}
              />
              <Button
                size="sm"
                className="gap-2 rounded-xl h-9"
                onClick={handleScanButtonClick}
                disabled={scanDisabled && !isScanBusy}
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {isScanBusy
                  ? "Scan läuft…"
                  : cooldownSecondsRemaining > 0
                    ? `Warten (${cooldownSecondsRemaining}s)`
                    : "Scan"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable filter panel */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-premium",
          showFilters ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-wrap gap-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 shadow-sm">
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter("status", value as DeviceStatus | "all")}
          >
            <SelectTrigger className="w-[170px] h-9 rounded-lg bg-background/50 border-border/50 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.os}
            onValueChange={(value) => updateFilter("os", value ?? "all")}
          >
            <SelectTrigger className="w-[170px] h-9 rounded-lg bg-background/50 border-border/50 text-xs">
              <SelectValue placeholder="Betriebssystem" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {OS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.health}
            onValueChange={(value) => updateFilter("health", value as AssetHealth | "all")}
          >
            <SelectTrigger className="w-[170px] h-9 rounded-lg bg-background/50 border-border/50 text-xs">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {HEALTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scan Dialog */}
      <ScanDialog
        open={scanOpen}
        onOpenChange={handleDialogOpenChange}
        scanState={scanState}
        onMinimize={handleMinimize}
        onRetry={handleRetry}
      />
    </div>
  );
}