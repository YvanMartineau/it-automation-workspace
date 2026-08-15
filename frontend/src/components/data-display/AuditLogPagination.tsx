/**
 * Cursor-based pagination controls for audit logs.
 * Maintains a cursor history stack to support "Previous".
 * @module components/data-display/AuditLogPagination
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";

interface AuditLogPaginationProps {
  readonly hasMore: boolean;
  readonly canGoBack: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
  readonly isFetching: boolean;
}

export function AuditLogPagination({
  hasMore,
  canGoBack,
  onNext,
  onPrevious,
  isFetching,
}: AuditLogPaginationProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-muted-foreground">
        {isFetching ? "Lade Einträge…" : "Cursor-basierte Paginierung aktiv"}
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