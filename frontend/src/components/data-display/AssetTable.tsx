// frontend/src/components/data-display/AssetTable.tsx
import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { getAssetColumns } from "./AssetColumns";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { AssetPagination } from "./AssetPagination";
import { AssetEmptyState } from "./AssetEmptyState";
import { TableSkeleton } from "#/components/feedback/TableSkeleton";
import { useDeleteAsset } from "#/hooks/useAssets";
import type { PaginatedAssetList } from "#/types/asset";

interface AssetTableProps {
  data: PaginatedAssetList | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFiltersReset: () => void;
}

export function AssetTable({
  data,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onFiltersReset,
}: AssetTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const deleteAsset = useDeleteAsset();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => getAssetColumns(deleteAsset.mutate), [deleteAsset.mutate]);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  const gridTemplateColumns = useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((col) => {
          const isFixedWidthColumn = col.id === "select" || col.id === "actions";
          return isFixedWidthColumn ? `${col.getSize()}px` : `minmax(${col.getSize()}px, 1fr)`;
        })
        .join(" "),
    [table.getState().columnSizing, columns]
  );

  const selectedRows = table.getSelectedRowModel().rows;
  const isVirtualized = data ? data.meta.totalItems > 100 : false;

  if (isLoading) {
    return <TableSkeleton rows={pageSize} columns={columns.length} />;
  }

  if (!data?.data.length) {
    return <AssetEmptyState onReset={onFiltersReset} />;
  }

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
          {table.getHeaderGroups().map((headerGroup) => (
          <div
            key={headerGroup.id}
            className="sticky top-0 z-10 grid isolate border-b will-change-transform"
            style={{ gridTemplateColumns, backgroundColor: "hsl(var(--secondary))", transform: "translateZ(0)" , width: "100%",}}
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