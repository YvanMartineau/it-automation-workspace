// frontend/src/components/data-display/AssetTable.tsx
import { useMemo, useRef } from "react";
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { AssetPagination } from "./AssetPagination";
import { AssetEmptyState } from "./AssetEmptyState";
import { TableSkeleton } from "#/components/feedback/TableSkeleton";
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

  // BUG FIX (horizontal scroll losing its styling): the header row and each
  // body row previously each set their own `width: "100%"` (or `w-full`)
  // independently, while relying on `display: grid` + `minmax(size, 1fr)`
  // tracks to force overflow when content was wider than the container.
  // That works in principle, but it means header and body rows only agree
  // on their rendered width *implicitly*, via each one separately resolving
  // "100% of my containing block" vs "however wide my grid tracks force me
  // to be" — plus the header additionally carried `transform: translateZ(0)`
  // for a sticky-position hint it didn't need, which can introduce its own
  // sub-pixel rounding under a transform vs. the untransformed body rows.
  // Small per-row disagreements compound as you scroll, which reads as the
  // table "losing its styling."
  //
  // Fix: compute one explicit pixel width from the actual column sizes and
  // apply it as `minWidth` to the header and every row, so they are always
  // measured identically instead of independently re-deriving a width that
  // happens to usually match.
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
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm">
          <span className="font-medium">{selectedRows.length}</span> Assets ausgewählt
        </div>
      )}

      <div className="rounded-md border">
        {/*
          Single scroll container for header + body. Horizontal scroll on small
          screens now natively moves both together — no scroll-sync JS needed.
          maxHeight is only applied when virtualizing, since that's the only
          case that needs a bounded vertical viewport for windowing to work;
          the plain-row path just grows with its content, no artificial scrollbox.
        */}
        <div
          ref={scrollContainerRef}
          className="w-full overflow-auto"
          style={isVirtualized ? { maxHeight: "600px" } : undefined}
        >
          {/* width:100% + minWidth is what makes the table shrink to fill
              available space when fewer columns are shown, and only
              overflow (via the parent's overflow-auto) once the visible
              columns' combined minimum exceeds the container. */}
          <div style={{ width: "100%", minWidth: `${tableMinWidth}px` }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <div
                key={headerGroup.id}
                className="sticky top-0 z-10 grid isolate border-b"
                style={{ gridTemplateColumns, backgroundColor: "hsl(var(--secondary))" }}
              >
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className="flex h-12 items-center px-4 text-left align-middle text-sm font-medium "
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "flex cursor-pointer select-none items-center gap-2"
                            : "flex items-center gap-2"
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

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
                    className="grid border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    style={{ gridTemplateColumns }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} className="flex items-center p-4 align-middle">
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