
//frontend/src/components/feedback/TableSkeleton.tsx
import { Skeleton } from "#/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 10, columns = 8 }: TableSkeletonProps) {
  return (
    <div className="space-y-2">
      {/* Header skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className="h-8 flex-1"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>

      {/* Row skeletons with staggered animation */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              className="h-12 flex-1"
              style={{
                animationDelay: `${(rowIndex * columns + colIndex) * 30}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

