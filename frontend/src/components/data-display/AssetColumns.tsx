//frontend/src/components/data-display/AssetColumns.tsx
/**
 * TanStack Table column definitions for Asset table
 * Type-safe columns with sorting, filtering, and custom rendering
 * @module components/data-display/AssetColumns
 */

import { createColumnHelper } from "@tanstack/react-table";
import { Checkbox } from "#/components/ui/checkbox";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import type { Asset } from "#/types/asset";

const columnHelper = createColumnHelper<Asset>();

function HealthScoreBar({ score }: { score: number }) {
  const colorClass =
    score >= 80
      ? "bg-success"
      : score >= 50
      ? "bg-warning"
      : score > 0
      ? "bg-danger"
      : "bg-muted";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", colorClass)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs tabular-nums">{score}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Asset["status"] }) {
  const variants: Record<Asset["status"], string> = {
    online: "bg-success/10 text-success border-success/20",
    offline: "bg-muted text-muted-foreground",
    maintenance: "bg-warning/10 text-warning border-warning/20",
    decommissioned: "bg-danger/10 text-danger border-danger/20",
  };

  const labels: Record<Asset["status"], string> = {
    online: "Online",
    offline: "Offline",
    maintenance: "Wartung",
    decommissioned: "Außer Betrieb",
  };

  return (
    <Badge variant="outline" className={cn(variants[status])}>
      {labels[status]}
    </Badge>
  );
}

export const assetColumns = [
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
      checked={
        table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
          ? ("indeterminate" as unknown as boolean)
          : table.getIsAllPageRowsSelected()
      }
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Alle Assets auswählen"
    />
    ),
    cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label={`${row.original.hostname} auswählen`}
    />
  ),
  size: 40,
  }),

  columnHelper.accessor("hostname", {
    header: "Hostname",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue()}</span>
    ),
    size: 200,
  }),

  columnHelper.accessor("ipAddress", {
    header: "IP-Adresse",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue()}</span>
    ),
    size: 140,
  }),

  columnHelper.accessor("macAddress", {
    header: "MAC-Adresse",
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue()}</span>
    ),
    size: 160,
  }),

  columnHelper.accessor("os", {
    header: "OS",
    cell: ({ getValue }) => (
      <span className="text-sm">{getValue()}</span>
    ),
    size: 100,
  }),

  columnHelper.accessor("lastSeen", {
    header: "Zuletzt gesehen",
    cell: ({ getValue }) => {
      const date = new Date(getValue());
      return (
        <span className="text-sm text-muted-foreground">
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
    size: 160,
  }),

  columnHelper.accessor("healthScore", {
    header: "Health Score",
    cell: ({ getValue }) => <HealthScoreBar score={getValue()} />,
    size: 120,
  }),

  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
    size: 120,
  }),

  columnHelper.accessor("department", {
    header: "Abteilung",
    cell: ({ getValue }) => <span className="text-sm">{getValue()}</span>,
    size: 120,
  }),

  /* 
  columnHelper.display({
    id: "actions",
    header: "",
    cell: ({ row }) => row.original.id, // Will be overridden by AssetRowActions
    size: 50,
  }),*/
];