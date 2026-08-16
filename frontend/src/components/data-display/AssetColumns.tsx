// frontend/src/components/data-display/AssetColumns.tsx
/**
 * TanStack Table column definitions for the Asset (Device) table.
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

const HEALTH_STYLES: Record<AssetHealth, string> = {
  healthy: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-danger/10 text-danger border-danger/20",
  unknown: "bg-muted text-muted-foreground border-muted",
};
const HEALTH_LABELS: Record<AssetHealth, string> = {
  healthy: "Gesund",
  warning: "Langsam",
  critical: "Kritisch",
  unknown: "Unbekannt",
};
function HealthBadge({ health }: { health: AssetHealth }) {
  return (
    <Badge variant="outline" className={cn(HEALTH_STYLES[health])}>
      {HEALTH_LABELS[health]}
    </Badge>
  );
}

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: "bg-success/10 text-success border-success/20",
  offline: "bg-danger/10 text-danger border-danger/20",
  unknown: "bg-muted text-muted-foreground border-muted",
};
const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  unknown: "Unbekannt",
};
function StatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * "–" for null OR undefined — deliberately loose (`== null`), not
 * `=== null`. The DeviceRead type only promises `| null`, but this file
 * was crashing on `undefined` in practice (stale mock data with a
 * missing key, not an explicit null) — treating the two as equivalent
 * here is defensive insurance against exactly that class of mismatch,
 * not a type-correctness statement.
 */
function formatPercent(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toFixed(0)}%`;
}
function formatLatency(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toFixed(0)} ms`;
}

/**
 * Column definitions are built via a factory rather than exported as a
 * static array, because the "actions" column needs an onDelete callback
 * bound to whatever mutation the consuming component owns (e.g.
 * useDeleteAsset().mutate). Call this inside a useMemo in the table
 * component, keyed on that callback.
 */
export function getAssetColumns(onDeleteAsset: (id: string) => void) {
  return [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          // Base UI's Checkbox (not Radix) takes `indeterminate` as its
          // own separate boolean prop — `checked` stays strictly boolean.
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
      cell: ({ getValue }) => <span className="truncate font-medium">{getValue() ?? "–"}</span>,
      size: 200,
    }),

    columnHelper.accessor("ip_address", {
      header: "IP-Adresse",
      cell: ({ getValue }) => <span className="truncate font-mono text-xs">{getValue()}</span>,
      size: 130,
    }),

    columnHelper.accessor("mac_address", {
      header: "MAC-Adresse",
      cell: ({ getValue }) => (
        <span className="truncate font-mono text-xs text-muted-foreground">{getValue() ?? "–"}</span>
      ),
      size: 150,
    }),

    columnHelper.accessor("os_info", {
      header: "OS",
      cell: ({ getValue }) => (
        <span className="truncate text-sm" title={getValue() ?? undefined}>
          {getValue() ?? "–"}
        </span>
      ),
      size: 220,
    }),

    columnHelper.accessor("latency_ms", {
      header: "Latenz",
      // Informational only — deliberately NOT part of Health. See
      // lib/assetHealth.ts's doc comment: this is wall-clock nmap
      // subprocess time, not real network RTT, and gets contaminated by
      // scan concurrency (Semaphore(50) in scanner.py).
      cell: ({ getValue }) => (
        <span className="truncate text-sm tabular-nums text-muted-foreground">
          {formatLatency(getValue())}
        </span>
      ),
      size: 90,
    }),

    columnHelper.accessor("cpu_percent", {
      header: "CPU",
      // Populated ONLY for the machine running the scan itself — expect
      // "–" on nearly every row. See scanner.py's local-host enrichment.
      cell: ({ getValue }) => (
        <span className="truncate text-sm tabular-nums text-muted-foreground">
          {formatPercent(getValue())}
        </span>
      ),
      size: 80,
    }),

    columnHelper.accessor("memory_percent", {
      header: "RAM",
      cell: ({ getValue }) => (
        <span className="truncate text-sm tabular-nums text-muted-foreground">
          {formatPercent(getValue())}
        </span>
      ),
      size: 80,
    }),

    columnHelper.accessor("open_ports", {
      header: "Offene Ports",
      // Informational, deliberately uncolored — see lib/assetHealth.ts:
      // port count alone isn't a security verdict without knowing the
      // device's role, which this system doesn't model.
      cell: ({ getValue }) => {
        const ports = getValue();
        if (ports == null) return <span className="text-muted-foreground">–</span>;
        if (ports.length === 0) return <span className="text-xs text-muted-foreground">Keine</span>;
        return (
          <span
            className="truncate text-xs text-muted-foreground"
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
        if (!raw) return <span className="text-sm text-muted-foreground">–</span>;
        const date = new Date(raw);
        return (
          <span className="truncate text-sm text-muted-foreground">
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
          <div className="flex items-center gap-1.5">
            <HealthBadge health={health} />
            {stale && (
              <Clock
                className="h-3.5 w-3.5 text-muted-foreground"
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
      header: "Aktionen",
      cell: ({ row }) => <AssetRowActions asset={row.original} onDelete={onDeleteAsset} />,
      size: 50,
    }),
  ];
}