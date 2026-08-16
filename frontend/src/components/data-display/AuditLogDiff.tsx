/**
 * Expandable diff viewer for audit log payload.
 * Handles both structured diff { field: { old, new } } and raw JSONB fallback.
 * @module components/data-display/AuditLogDiff
 */

import React from "react";
import { Minus, Plus, ArrowRight, FileJson } from "lucide-react";

interface DiffEntry {
  readonly old: unknown;
  readonly new: unknown;
}

function isDiffEntry(value: unknown): value is DiffEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "old" in value &&
    "new" in value
  );
}

function isDiffShape(payload: unknown): payload is Record<string, DiffEntry> {
  if (typeof payload !== "object" || payload === null) return false;
  return Object.values(payload).every(isDiffEntry);
}

interface AuditLogDiffProps {
  readonly payload: unknown;
}

function AuditLogDiffInner({ payload }: AuditLogDiffProps) {
  if (isDiffShape(payload)) {
    const entries = Object.entries(payload);
    return (
      <div className="rounded-md border bg-muted/40 p-4">
        <h4 className="mb-3 text-sm font-semibold text-foreground">Änderungsdetails</h4>
        <dl className="space-y-3">
          {entries.map(([field, change]) => (
            <div
              key={field}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm"
            >
              <dt className="sr-only">Feld</dt>
              <dd className="font-medium text-muted-foreground capitalize">{field}</dd>
              <div className="flex items-center gap-2">
                <div className="flex min-w-[120px] items-center gap-1.5 rounded bg-destructive/10 px-2.5 py-1.5 text-destructive">
                  <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate font-mono text-xs">{String(change.old)}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div className="flex min-w-[120px] items-center gap-1.5 rounded bg-success/10 px-2.5 py-1.5 text-success">
                  <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate font-mono text-xs">{String(change.new)}</span>
                </div>
              </div>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  // Fallback: raw JSONB payload
  return (
    <div className="rounded-md border bg-muted/40 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileJson className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        Payload
      </h4>
      <pre className="overflow-x-auto rounded p-3 text-xs font-mono text-muted-foreground">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

export const AuditLogDiff = React.memo(AuditLogDiffInner);