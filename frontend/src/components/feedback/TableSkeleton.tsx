// frontend/src/components/feedback/TableSkeleton.tsx
/**
 * Table skeleton — Premium Edition with shimmer effect.
 * Matches the real table's header height and row padding.
 */

import { Skeleton } from "#/components/ui/skeleton";
import { cn } from "#/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 8 }: TableSkeletonProps): JSX.Element {
  return (
    <div className="rounded-xl border border-border/80 shadow-card dark:shadow-card-dark overflow-hidden bg-card">
      {/* Header skeleton */}
      <div className="flex h-11 items-center border-b border-border/60 bg-secondary/50 px-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="flex-1 px-2">
            <Skeleton
              className={cn("h-3 rounded-full bg-muted/60", i === 0 ? "w-4" : "w-16")}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          </div>
        ))}
      </div>

      {/* Row skeletons */}
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex h-[52px] items-center border-b border-border/30 px-4"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={`cell-${rowIndex}-${colIndex}`} className="flex-1 px-2">
                <Skeleton
                  className={cn(
                    "h-3 rounded-full bg-muted/50",
                    colIndex === 0 ? "w-4" : colIndex === columns - 1 ? "w-6" : "w-20"
                  )}
                  style={{
                    animationDelay: `${(rowIndex * columns + colIndex) * 40}ms`,
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}