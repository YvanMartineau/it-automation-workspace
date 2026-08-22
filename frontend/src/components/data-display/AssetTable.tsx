// frontend/src/components/data-display/AssetTable.tsx
import { useMemo, useRef } from "react";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { AssetPagination } from "./AssetPagination";
import { AssetEmptyState } from "./AssetEmptyState";
import { TableSkeleton } from "#/components/feedback/TableSkeleton";
import { cn } from "#/lib/utils";
import type { Asset, PaginatedAssetList } from "#/types/asset";

interface AssetTableProps {
  table: TanStackTable<Asset>;
  data: PaginatedAssetList | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFiltersReset: () => void;
}

export function AssetTable({
  table,
  data,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersReset,
}: AssetTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleColumns = table.getVisibleLeafColumns();

  const tableMinWidth = useMemo(
    () => visibleColumns.reduce((sum, col) => sum + col.getSize(), 0),
    [visibleColumns]
  );

  const gridTemplateColumns = useMemo(
    () =>
      visibleColumns
        .map((col) => {
          const isFixedWidthColumn = col.id === "select" || col.id === "actions";
          return isFixedWidthColumn ? `${col.getSize()}px` : `minmax(${col.getSize()}px, 1fr)`;
        })
        .join(" "),
    [visibleColumns]
  );

  const isVirtualized = data ? data.meta.totalItems > 100 : false;

  if (isLoading) {
    return <TableSkeleton rows={pageSize} columns={visibleColumns.length} />;
  }

  if (!data?.data.length) {
    return <AssetEmptyState onReset={onFiltersReset} />;
  }

  const selectedRows = table.getSelectedRowModel().rows;

  return (
    <div className="space-y-4">
      {/* Selection banner */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-primary/[0.06] border border-primary/15 px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse-soft" aria-hidden="true" />
          <span className="text-sm font-medium text-primary">
            {selectedRows.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {selectedRows.length === 1 ? "Asset ausgewählt" : "Assets ausgewählt"}
          </span>
        </div>
      )}

      {/* Table container */}
      <div className="rounded-xl border border-border/80 shadow-card dark:shadow-card-dark overflow-hidden bg-card">
        <div
          ref={scrollContainerRef}
          className="w-full overflow-auto"
          style={isVirtualized ? { maxHeight: "600px" } : undefined}
        >
          <div style={{ width: "100%", minWidth: `${tableMinWidth}px` }}>
            {/* Sticky Header */}
            {table.getHeaderGroups().map((headerGroup) => (
              <div
                key={headerGroup.id}
                className="sticky top-0 z-10 grid isolate border-b border-border/60"
                style={{ gridTemplateColumns }}
              >
                <div
                  className="contents"
                  style={{ backgroundColor: "hsl(var(--secondary))" }}
                >
                  {headerGroup.headers.map((header) => (
                    <div
                      key={header.id}
                      className="flex h-11 items-center px-4 text-left align-middle bg-secondary/80 backdrop-blur-sm"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70",
                            header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground/80"
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Body */}
            {isVirtualized ? (
              <VirtualizedTableBody
                table={table}
                gridTemplateColumns={gridTemplateColumns}
                tableMinWidth={tableMinWidth}
                scrollContainerRef={scrollContainerRef}
              />
            ) : (
              <div>
                {table.getRowModel().rows.map((row) => (
                  <div
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "grid border-b border-border/40",
                      /* NO transition on rows — performance critical */
                      "hover:bg-accent/25",
                      "data-[state=selected]:bg-primary/[0.04]"
                    )}
                    style={{ gridTemplateColumns }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="flex items-center px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AssetPagination
        page={page}
        pageSize={pageSize}
        totalPages={data.meta.totalPages}
        totalItems={data.meta.totalItems}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
