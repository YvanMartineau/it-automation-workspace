// frontend/src/hooks/useAssetTable.ts
/**
 * Owns the TanStack Table instance for the asset list.
 *
 * This used to live inline inside AssetTable.tsx. Lifted up here so the same
 * `table` instance can be shared with AssetToolbar — that's required for:
 *  - the new column-visibility ("display fields") toggle, which needs to
 *    call `table.getAllColumns()` / `column.toggleVisibility()`
 *  - real `selectedCount` / bulk-delete wiring — previously Index.tsx hard
 *    coded `selectedCount={0}` and `onBulkDelete={() => {}}` with a comment
 *    "Will be wired from AssetTable" that was never followed through, so
 *    bulk delete was silently non-functional. Flagged separately in chat.
 *
 * @module hooks/useAssetTable
 */

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { getAssetColumns } from "#/components/data-display/AssetColumns";
import { useDeleteAsset } from "#/hooks/useAssets";
import type { Asset, PaginatedAssetList } from "#/types/asset";

export function useAssetTable(data: PaginatedAssetList | undefined) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const deleteAsset = useDeleteAsset();

  const columns = useMemo(() => getAssetColumns(deleteAsset.mutate), [deleteAsset.mutate]);

  const table = useReactTable<Asset>({
    data: data?.data ?? [],
    columns,
    state: { sorting, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    // BUG FIX (the actual freeze — confirmed with a reproducible test, see
    // chat): pagination is fully external here (page/pageSize live in
    // Index.tsx's own state, not table.getState().pagination), but the table
    // was never told that. Without `manualPagination: true`, TanStack Table
    // assumes IT owns pagination, so every time getCoreRowModel/
    // getFilteredRowModel/getSortedRowModel recompute (which happens on every
    // page or filter change, and also gets pulled forward by calling
    // getSelectedRowModel() below), it calls its internal
    // `_autoResetPageIndex()` — which tries to reset a pagination state nothing
    // is reading, triggering another internal state update, which triggers
    // another recompute, and so on. In an isolated repro this produced
    // thousands of repeated React state-update warnings and never settled —
    // a real infinite render loop, not just a slow one. `manualPagination:
    // true` tells the table "pagination is not yours," which disables that
    // auto-reset path entirely. Confirmed the loop is gone with this set.
    manualPagination: true,
    // BUG FIX (secondary, also in the original code): without a custom
    // getRowId, TanStack Table keys row-selection state by the row's *index
    // within the current page* (0, 1, 2, ...). Since pagination reuses those
    // same index keys for a completely different set of underlying assets,
    // selection state "leaks" across pages — e.g. select the first row on
    // page 1, flip to page 2, and its first row shows as selected too,
    // purely by coincidence of index. Keying by the real asset id fixes it.
    getRowId: (row) => row.id,
  });

  const selectedRows = table.getSelectedRowModel().rows;

  return { table, deleteAsset, selectedRows };
}