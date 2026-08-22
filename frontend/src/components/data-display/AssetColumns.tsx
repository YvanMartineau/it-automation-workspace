// frontend/src/components/data-display/AssetColumns.tsx
/**
 * TanStack Table column definitions — Premium Edition.
 * @module components/data-display/AssetColumns
 */

import { createColumnHelper } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { Checkbox } from "#/components/ui/checkbox";
import { Badge } from "#/components/ui/badge";
import { AssetRowActions } from "#/components/data-display/AssetRowActions";
import { deriveAssetHealth, isDeviceStale } from "#/lib/assetHealth";
import { cn } from "#/lib/utils";
import type { Asset, AssetHealth, DeviceStatus } from "#/types/asset";

const columnHelper = createColumnHelper<Asset>();

// ---------------------------------------------------------------------------
// Premium Health Badge
// ---------------------------------------------------------------------------

const HEALTH_STYLES: Record<AssetHealth, string> = {
  healthy: "bg-success/8 text-success border-success/20",
  warning: "bg-warning/8 text-warning border-warning/20",
  critical: "bg-danger/8 text-danger border-danger/20",
  unknown: "bg-muted/60 text-muted-foreground border-muted",
};

const HEALTH_LABELS: Record<AssetHealth, string> = {
  healthy: "Gesund",
  warning: "Langsam",
  critical: "Kritisch",
  unknown: "Unbekannt",
};

function HealthBadge({ health }: { health: AssetHealth }): JSX.Element {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        HEALTH_STYLES[health]
      )}
    >
      {HEALTH_LABELS[health]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Premium Status Badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: "bg-success/8 text-success border-success/20",
  offline: "bg-danger/8 text-danger border-danger/20",
  unknown: "bg-muted/60 text-muted-foreground border-muted",
};

const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Unbekannt",
};

function StatusBadge({ status }: { status: DeviceStatus }): JSX.Element {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatPercent(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toFixed(0)}%`;
}

function formatLatency(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toFixed(0)} ms`;
}

// ---------------------------------------------------------------------------
// Column Factory
// ---------------------------------------------------------------------------

export function getAssetColumns(onDeleteAsset: (id: string) => void) {
  return [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Alle Assets auswählen"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`${row.original.hostname ?? row.original.ip_address} auswählen`}
        />
      ),
      size: 40,
    }),

    columnHelper.accessor("hostname", {
      header: "Hostname",
      cell: ({ getValue }) => (
        <span className="truncate font-semibold text-sm text-foreground/90">
          {getValue() ?? "–"}
        </span>
      ),
      size: 300,
    }),

    columnHelper.accessor("ip_address", {
      header: "IP-Adresse",
      cell: ({ getValue }) => (
        <span className="truncate font-mono text-[11px] text-muted-foreground/80 tracking-wide">
          {getValue()}
        </span>
      ),
      size: 150,
    }),

    columnHelper.accessor("mac_address", {
      header: "MAC-Adresse",
      cell: ({ getValue }) => (
        <span className="truncate font-mono text-[11px] text-muted-foreground/60 tracking-wide">
          {getValue() ?? "–"}
        </span>
      ),
      size: 180,
    }),

    columnHelper.accessor("os_info", {
      header: "OS",
      cell: ({ getValue }) => (
        <span className="truncate text-xs text-muted-foreground/80" title={getValue() ?? undefined}>
          {getValue() ?? "–"}
        </span>
      ),
      size: 130,
    }),

    columnHelper.accessor("latency_ms", {
      header: "Latenz",
      cell: ({ getValue }) => (
        <span className="truncate text-xs tabular-nums text-muted-foreground/70">
          {formatLatency(getValue())}
        </span>
      ),
      size: 100,
    }),

    columnHelper.accessor("cpu_percent", {
      header: "CPU",
      cell: ({ getValue }) => (
        <span className="truncate text-xs tabular-nums text-muted-foreground/70">
          {formatPercent(getValue())}
        </span>
      ),
      size: 80,
    }),

    columnHelper.accessor("memory_percent", {
      header: "RAM",
      cell: ({ getValue }) => (
        <span className="truncate text-xs tabular-nums text-muted-foreground/70">
          {formatPercent(getValue())}
        </span>
      ),
      size: 80,
    }),

    columnHelper.accessor("open_ports", {
      header: "Offene Ports",
      cell: ({ getValue }) => {
        const ports = getValue();
        if (ports == null) return <span className="text-muted-foreground/50 text-xs">–</span>;
        if (ports.length === 0) return <span className="text-[11px] text-muted-foreground/50">Keine</span>;
        return (
          <span
            className="truncate text-[11px] text-muted-foreground/60"
            title={ports.map((p) => `${p.port}/${p.service}`).join(", ")}
          >
            {ports.length} offen
          </span>
        );
      },
      size: 110,
    }),

    columnHelper.accessor("last_seen", {
      header: "Zuletzt gesehen",
      cell: ({ getValue }) => {
        const raw = getValue();
        if (!raw) return <span className="text-xs text-muted-foreground/50">–</span>;
        const date = new Date(raw);
        return (
          <span className="truncate text-xs text-muted-foreground/60 tabular-nums">
            {date.toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        );
      },
      size: 150,
    }),

    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      size: 110,
    }),

    columnHelper.display({
      id: "health",
      header: "Health",
      cell: ({ row }) => {
        const health = deriveAssetHealth(row.original);
        const stale = isDeviceStale(row.original);
        return (
          <div className="flex items-center gap-2">
            <HealthBadge health={health} />
            {stale && (
              <Clock
                className="h-3.5 w-3.5 text-muted-foreground/40"
                aria-label="Daten veraltet — letzter Scan vor über 24h"
              />
            )}
          </div>
        );
      },
      size: 130,
    }),

    columnHelper.display({
      id: "actions",
      header: "",
      cell: ({ row }) => <AssetRowActions asset={row.original} onDelete={onDeleteAsset} />,
      size: 50,
    }),
  ];
}
