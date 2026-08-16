/**
 * Offset pagination controls for audit logs.
 * @module components/data-display/AuditLogPagination
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";

interface AuditLogPaginationProps {
  readonly offset: number;
  readonly limit: number;
  readonly itemCount: number;
  readonly hasMore: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly isFetching: boolean;
}

export function AuditLogPagination({
  offset,
  itemCount,
  hasMore,
  onNext,
  onPrevious,
  isFetching,
}: AuditLogPaginationProps) {
  const start = offset + 1;
  const end = offset + itemCount;
  const canGoBack = offset > 0;

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-muted-foreground">
        {isFetching ? "Lade Einträge…" : `Einträge ${start}–${end}`}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!canGoBack || isFetching}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasMore || isFetching}
          className="gap-1"
        >
          Weiter
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}