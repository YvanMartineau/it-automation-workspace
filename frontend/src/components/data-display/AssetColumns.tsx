// frontend/src/components/data-display/AssetColumns.tsx
/**
 * TanStack Table column definitions for Asset table
 * Type-safe columns with sorting, filtering, and custom rendering
 * @module components/data-display/AssetColumns
 */

import { createColumnHelper } from "@tanstack/react-table";
import { Checkbox } from "#/components/ui/checkbox";
import { Badge } from "#/components/ui/badge";
import { AssetRowActions } from "#/components/data-display/AssetRowActions";
import { cn } from "#/lib/utils";
import type { Asset } from "#/types/asset";

const columnHelper = createColumnHelper<Asset>();

function HealthScoreBar({ score }: { score: number }) {
  const colorClass =
    score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : score > 0 ? "bg-danger" : "bg-muted";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", colorClass)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums">{score}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Asset["status"] }) {
  const variants: Record<Asset["status"], string> = {
    online: "bg-success/10 text-success border-success/20",
    offline: "bg-danger/10 text-danger border-danger/20",
    sleeping: "bg-warning/10 text-warning border-warning/20",
  };
  const labels: Record<Asset["status"], string> = {
    online: "Online",
    offline: "Offline",
    sleeping: "Schlafend",
  };
  return (
    <Badge variant="outline" className={cn(variants[status])}>
      {labels[status]}
    </Badge>
  );
}

/**
 * Column definitions are built via a factory rather than exported as a static
 * array, because the "actions" column needs an onDelete callback bound to
 * whatever mutation the consuming component owns (e.g. useDeleteAsset().mutate).
 * Call this inside a useMemo in the table component, keyed on that callback.
 */
export function getAssetColumns(onDeleteAsset: (id: string) => void) {
  return [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          // CORRECTION: I previously "fixed" this to Radix's pattern
          // (checked={... ? true : ... ? "indeterminate" : false}), on the
          // wrong assumption that this project used Radix-based shadcn
          // primitives. It doesn't — this is Base UI (@base-ui/react), whose
          // Checkbox takes `indeterminate` as its own separate boolean prop,
          // not folded into `checked` (checked is strictly boolean here).
          // The original two-prop version below was correct as written.
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
          aria-label={`${row.original.hostname} auswählen`}
        />
      ),
      size: 40,
    }),

    columnHelper.accessor("hostname", {
      header: "Hostname",
      cell: ({ getValue }) => <span className="truncate font-medium">{getValue()}</span>,
      size: 200,
    }),

    columnHelper.accessor("ipAddress", {
      header: "IP-Adresse",
      cell: ({ getValue }) => <span className="truncate font-mono text-xs">{getValue()}</span>,
      size: 130,
    }),

    columnHelper.accessor("macAddress", {
      header: "MAC-Adresse",
      cell: ({ getValue }) => (
        <span className="truncate font-mono text-xs text-muted-foreground">{getValue()}</span>
      ),
      size: 150,
    }),

    columnHelper.accessor("os", {
      header: "OS",
      cell: ({ getValue }) => <span className="truncate text-sm">{getValue()}</span>,
      size: 90,
    }),

    columnHelper.accessor("lastSeen", {
      header: "Zuletzt gesehen",
      cell: ({ getValue }) => {
        const date = new Date(getValue());
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

    columnHelper.accessor("healthScore", {
      header: "Health Score",
      cell: ({ getValue }) => <HealthScoreBar score={getValue()} />,
      size: 120,
    }),

    columnHelper.accessor("status", {
      header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue()} />,
      size: 110,
    }),

    columnHelper.accessor("specs", {
      header: "Specs",
      cell: ({ getValue }) => {
        const { cpu, ram, storage } = getValue();
        return (
          <span className="truncate text-xs text-muted-foreground">
            CPU {cpu} · RAM {ram} · {storage}
          </span>
        );
      },
      size: 190,
    }),

    columnHelper.display({
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => <AssetRowActions asset={row.original} onDelete={onDeleteAsset} />,
      size: 50,
    }),
  ];
}