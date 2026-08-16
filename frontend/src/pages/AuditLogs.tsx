/**
 * Audit Log Viewer Page
 * Immutable, append-only audit trail with cursor pagination and diff view.
 * @module pages/AuditLogs
 */

import { useState, useCallback, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuditLogs } from "#/hooks/useAuditLogs";
import { AuditLogToolbar } from "#/components/data-display/AuditLogToolbar";
import { AuditLogTable } from "#/components/data-display/AuditLogTable";
import { AuditLogPagination } from "#/components/data-display/AuditLogPagination";
import type { AuditLogFilters } from "#/types/audit-log";

const DEFAULT_FILTERS: AuditLogFilters = {
  action: "all",
  resourceType: "all",
};

export default function AuditLogs() {
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);

  const { data, isLoading, isFetching } = useAuditLogs(filters, cursor);

  const logs = useMemo(() => data?.data ?? [], [data?.data]);

  const handleFiltersChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setCursor(null);
    setCursorHistory([]);
  }, []);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setCursor(null);
    setCursorHistory([]);
  }, []);

  const handleNext = useCallback(() => {
    if (!data?.meta.nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor]);
    setCursor(data.meta.nextCursor);
  }, [data?.meta.nextCursor, cursor]);

  const handlePrevious = useCallback(() => {
    if (cursorHistory.length === 0) return;
    const newHistory = [...cursorHistory];
    const previousCursor = newHistory.pop() ?? null;
    setCursorHistory(newHistory);
    setCursor(previousCursor);
  }, [cursorHistory]);

  const hasMore = data?.meta.hasMore ?? false;
  const canGoBack = cursorHistory.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Append-Only
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">
            {isFetching && !isLoading
              ? "Aktualisiere Einträge…"
              : "Unveränderliches Protokoll aller Systemaktivitäten"}
          </p>
        </div>
      </div>

      <AuditLogToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
        data={logs}
      />

      <AuditLogTable data={logs} isLoading={isLoading} />

      {!isLoading && logs.length > 0 && (
        <AuditLogPagination
          hasMore={hasMore}
          canGoBack={canGoBack}
          onNext={handleNext}
          onPrevious={handlePrevious}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}