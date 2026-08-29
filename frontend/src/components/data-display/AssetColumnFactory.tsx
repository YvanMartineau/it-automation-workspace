// frontend/src/components/data-display/AssetColumnFactory.tsx
/**
 * TanStack Table column definitions factory.
 * @module components/data-display/AssetColumnFactory
 */

import { createColumnHelper } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { Checkbox } from "#/components/ui/checkbox";
import { AssetRowActions } from "#/components/data-display/AssetRowActions";
import { HealthBadge, StatusBadge } from "#/components/data-display/AssetColumns";
import { deriveAssetHealth, isDeviceStale } from "#/lib/assetHealth";
import type { Asset } from "#/types/asset";

const columnHelper = createColumnHelper<Asset>();

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
