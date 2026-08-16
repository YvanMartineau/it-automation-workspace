/**
 * Audit Log Viewer Page
 * @module pages/AuditLogs
 */

import { useState, useCallback, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuditLogs } from "#/hooks/useAuditLogs";
import { AuditLogToolbar } from "#/components/data-display/AuditLogToolbar";
import { AuditLogTable } from "#/components/data-display/AuditLogTable";
import { AuditLogPagination } from "#/components/data-display/AuditLogPagination";
import type { AuditLogFilters } from "#/types/audit-log";

const DEFAULT_FILTERS: AuditLogFilters = {};
const LIMIT = 25;

export default function AuditLogs() {
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_FILTERS);
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isFetching } = useAuditLogs(filters, offset);

  const logs = useMemo(() => data?.data ?? [], [data?.data]);
  const hasMore = data?.meta.hasMore ?? false;

  const handleFiltersChange = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setOffset(0);
  }, []);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setOffset(0);
  }, []);

  const handleNext = useCallback(() => {
    setOffset((prev) => prev + LIMIT);
  }, []);

  const handlePrevious = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - LIMIT));
  }, []);

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
          offset={offset}
          limit={LIMIT}
          itemCount={logs.length}
          hasMore={hasMore}
          onNext={handleNext}
          onPrevious={handlePrevious}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}