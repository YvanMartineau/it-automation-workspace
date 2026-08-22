// frontend/src/components/data-display/AssetPagination.tsx
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";

interface AssetPaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function AssetPagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: AssetPaginationProps) {
  const pageSizeOptions = [25, 50, 100];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-2">
      <div className="text-xs text-muted-foreground/60 font-medium">
        {totalItems.toLocaleString()} Assets gesamt
      </div>

      <div className="flex items-center gap-5">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/60 font-medium">Zeilen</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[68px] rounded-lg bg-card border-border/60 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)} className="text-xs">
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page indicator */}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className="text-muted-foreground/60">Seite</span>
          <span className="text-foreground font-semibold tabular-nums">{page}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground/60 tabular-nums">{totalPages}</span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            aria-label="Erste Seite"
          >
            <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Vorherige Seite"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Nächste Seite"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            aria-label="Letzte Seite"
          >
            <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}