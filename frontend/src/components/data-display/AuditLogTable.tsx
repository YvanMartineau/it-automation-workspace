/**
 * TanStack Table v8 implementation for audit logs.
 * @module components/data-display/AuditLogTable
 */

import React, { useMemo, useState } from "react";
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { ChevronDown, ChevronRight, Lock, Shield } from "lucide-react";
import { AuditLogDiff } from "./AuditLogDiff";
import { TableSkeleton } from "#/components/feedback/TableSkeleton";
import type { AuditLog } from "#/types/audit-log";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function getActionColor(action: string): string {
  if (action.endsWith(".created") || action.endsWith(".login")) return "bg-success/10 text-success";
  if (action.endsWith(".deleted") || action.endsWith(".logout")) return "bg-destructive/10 text-destructive";
  if (action.endsWith(".updated") || action.endsWith(".retried")) return "bg-warning/10 text-warning";
  return "bg-info/10 text-info";
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    "asset.created": "Asset erstellt",
    "asset.updated": "Asset aktualisiert",
    "asset.deleted": "Asset gelöscht",
    "asset.scanned": "Netzwerk-Scan",
    "onboarding.created": "Onboarding erstellt",
    "onboarding.updated": "Onboarding aktualisiert",
    "onboarding.retried": "Onboarding wiederholt",
    "user.login": "Anmeldung",
    "user.logout": "Abmeldung",
    "user.permission_changed": "Berechtigung geändert",
    "report.generated": "Bericht erstellt",
    "report.deleted": "Bericht gelöscht",
  };
  return map[action] ?? action;
}

function getResourceTypeLabel(type: string | null): string {
  if (!type) return "—";
  const map: Record<string, string> = {
    asset: "Asset",
    onboarding: "Onboarding",
    user: "Benutzer",
    report: "Bericht",
  };
  return map[type] ?? type;
}

interface AuditLogTableProps {
  readonly data: readonly AuditLog[];
  readonly isLoading: boolean;
}

const COLUMNS: ColumnDef<AuditLog>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) =>
      row.original.payload ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => row.toggleExpanded()}
          aria-label={row.getIsExpanded() ? "Details einklappen" : "Details ausklappen"}
          aria-expanded={row.getIsExpanded()}
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      ) : null,
    size: 40,
  },
  {
    accessorKey: "timestamp",
    header: "Zeitstempel",
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return <span className="tabular-nums text-muted-foreground">{formatTimestamp(value)}</span>;
    },
    size: 180,
  },
  {
    accessorKey: "actor",
    header: "Akteur",
    cell: ({ getValue }) => {
      const value = getValue() as string;
      return <span className="font-medium">{value}</span>;
    },
    size: 200,
  },
  {
    accessorKey: "action",
    header: "Aktion",
    cell: ({ getValue }) => {
      const action = getValue() as string;
      return (
        <Badge variant="secondary" className={`${getActionColor(action)} border-0`}>
          {getActionLabel(action)}
        </Badge>
      );
    },
    size: 160,
  },
  {
    accessorKey: "targetType",
    header: "Ressource",
    cell: ({ getValue }) => {
      const value = getValue() as string | null;
      return <span className="text-muted-foreground">{getResourceTypeLabel(value)}</span>;
    },
    size: 120,
  },
  {
    accessorKey: "targetId",
    header: "Ressourcen-ID",
    cell: ({ getValue }) => {
      const value = getValue() as string | null;
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          {value ?? "—"}
        </code>
      );
    },
    size: 140,
  },
];

function AuditLogTableInner({ data, isLoading }: AuditLogTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const tableData = useMemo(() => [...data], [data]);

  const table = useReactTable({
    data: tableData,
    columns: COLUMNS,
    state: { expanded },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: (row) => row.original.payload !== null,
    getRowId: (row) => row.id,
  });

  if (isLoading) {
    return <TableSkeleton rows={6} />;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Shield className="mb-4 h-12 w-12 text-muted-foreground/50" aria-hidden="true" />
        <h3 className="text-lg font-semibold">Keine Audit-Einträge gefunden</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Passen Sie die Filter an oder warten Sie auf neue Aktivitäten.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Append-Only Log — Immutable
        </span>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="whitespace-nowrap"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              <TableRow
                data-state={row.getIsExpanded() ? "expanded" : undefined}
                className="transition-colors hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {row.getIsExpanded() && row.original.payload !== null && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLUMNS.length} className="p-0">
                    <div className="px-4 py-3">
                      <AuditLogDiff payload={row.original.payload} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const AuditLogTable = React.memo(AuditLogTableInner);