//frontend/src/components/data-display/AssetTable.tsx
import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { assetColumns } from "./AssetColumns";
import { VirtualizedTableBody } from "./VirtualizedTableBody";
import { AssetRowActions } from "./AssetRowActions";
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

  const table = useReactTable({
    data: data?.data ?? [],
    columns: assetColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows;

  const handleDelete = (id: string) => {
    deleteAsset.mutate(id);
  };

  if (isLoading) {
    return <TableSkeleton rows={pageSize} columns={assetColumns.length} />;
  }

  if (!data?.data.length) {
    return <AssetEmptyState onReset={onFiltersReset} />;
  }

  return (
    <div className="space-y-4">
      {/* Selected rows indicator */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm">
          <span className="font-medium">{selectedRows.length}</span> Assets ausgewählt
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="border-b bg-muted/50 [&_tr]:border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={
                            header.column.getCanSort()
                              ? "flex items-center gap-2 cursor-pointer select-none"
                              : ""
                          }
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {{
                            asc: " ↑",
                            desc: " ↓",
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          </table>
        </div>

        {/* Virtualized body for performance */}
        {data.meta.totalItems > 100 ? (
          <VirtualizedTableBody table={table} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full caption-bottom text-sm">
              <tbody className="[&_tr:last-child]:border-0">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="p-4 align-middle"
                      >
                        {cell.column.id === "actions" ? (
                          <AssetRowActions
                            asset={row.original}
                            onDelete={handleDelete}
                          />
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
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

