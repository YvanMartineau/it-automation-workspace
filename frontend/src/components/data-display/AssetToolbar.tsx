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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
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
import { useScanStream } from "#/hooks/useScanStream";
import { useAuthStore } from "#/hooks/useAuth";
import { scanRequestSchema } from "#/types/scan";
import type { Table as TanStackTable } from "@tanstack/react-table";
import type { Asset, AssetFilters, DeviceStatus, AssetHealth } from "#/types/asset";

// Falls back here if nothing else supplies a default. Hardcoded per team
// decision rather than read from a VITE_* env var for this pass.
const DEFAULT_SCAN_SUBNET = "192.168.179.0/24";

interface AssetToolbarProps {
  table: TanStackTable<Asset>;
  filters: AssetFilters;
  onFiltersChange: (filters: AssetFilters) => void;
  selectedCount: number;
  onBulkDelete: () => void;
  /** Called when a scan completes with the number of assets found online. */
  onScanComplete?: (foundCount: number) => void;
}

// "sleeping" removed, "unknown" added — matches the real DeviceStatus
// nmap can actually report (models/device.py's DeviceStatus enum).
const STATUS_OPTIONS: { value: DeviceStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "unknown", label: "Unbekannt" },
];

// No longer a fixed enum — os_info is nmap's free-text OS-match string
// (e.g. "Linux 5.X (88% confidence)"), matched server-side via ILIKE
// substring (see device_service.py's list_devices_paginated). "Other" is
// dropped: there's no substring that meaningfully matches "anything else"
// against free text.
const OS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Alle OS" },
  { value: "Windows", label: "Windows" },
  { value: "Linux", label: "Linux" },
  { value: "Mac", label: "macOS" },
  { value: "iOS", label: "iOS" },
  { value: "Android", label: "Android" },
];

// Labels no longer imply a numeric score — there isn't one. See
// lib/assetHealth.ts for what each state actually means (status +,
// for the scan host only, cpu/memory thresholds).
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

  // Dev-only diagnostic — safe to remove once you've confirmed the
  // AuthBootstrapGate flow from earlier in this thread is deployed and
  // working, since that's what fixed `role` coming back undefined.
  if (import.meta.env.DEV && !isAdmin) {
    console.debug("[AssetToolbar] scan button hidden — current role:", role);
  }

  const updateFilter = <K extends keyof AssetFilters>(
    key: K,
    value: AssetFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  // Toast + auto-close on completion/error. Driven by useScanStream's real
  // state transitions, not a simulated interval.
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

  // Ticks every second while a 429 cooldown is active, to drive the
  // countdown label on the scan button. No interval is created once
  // cooldownUntil is null or already in the past.
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
    // Already running — reopen the dialog to watch it, don't start a new one.
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

  // Closing/minimizing the dialog NEVER aborts the SSE reader — the scan
  // (and our listening for it) keeps going in the background. Only
  // unmounting this component (e.g. navigating away) stops it.
  const handleMinimize = useCallback(() => setScanOpen(false), []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setScanOpen(open);
      // Closing a finished/errored dialog clears the result so the next
      // button click starts fresh instead of showing stale data.
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

          {/* Network Scan — admin only, per POST /scan's get_admin_user dependency */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Input
                value={subnetInput}
                onChange={(e) => setSubnetInput(e.target.value)}
                placeholder="192.168.1.0/24"
                aria-label="Subnetz für Netzwerk-Scan"
                className="w-40"
                disabled={isScanBusy}
              />
              <Button
                size="sm"
                className="gap-2"
                onClick={handleScanButtonClick}
                disabled={scanDisabled && !isScanBusy}
              >
                <ScanLine className="h-4 w-4" aria-hidden="true" />
                {isScanBusy
                  ? "Scan läuft… (anzeigen)"
                  : cooldownSecondsRemaining > 0
                    ? `Warten (${cooldownSecondsRemaining}s)`
                    : "Netzwerk-Scan"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-4 rounded-lg border bg-card p-4">
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter("status", value as DeviceStatus | "all")}
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
            onValueChange={(value) => updateFilter("os", value ?? "all")}
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
        onOpenChange={handleDialogOpenChange}
        scanState={scanState}
        onMinimize={handleMinimize}
        onRetry={handleRetry}
      />
    </div>
  );
}