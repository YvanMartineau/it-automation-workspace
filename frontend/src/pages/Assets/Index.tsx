/**
 * Asset Dashboard Page
 * High-density data table with real-time updates, virtualization, and batch operations
 * @module pages/Assets/Index
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAssets, useDebouncedValue } from "#/hooks/useAssets";
import { useAssetTable } from "#/hooks/useAssetTable";
import { AssetStats } from "#/components/data-display/AssetStats";
import { AssetToolbar } from "#/components/data-display/AssetToolbar";
import { AssetTable } from "#/components/data-display/AssetTable";
import type { AssetFilters } from "#/types/asset";

const DEFAULT_FILTERS: AssetFilters = {
  search: "",
  status: "all",
  os: "all",
  health: "all",
};

export default function AssetIndex() {
  const [filters, setFilters] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // BUG FIX: filters.search is the single source of truth (updated on every
  // keystroke by the toolbar). We derive a debounced value straight from it
  // instead of duplicating it into a second piece of state that nothing kept
  // in sync — see the comment on useDebouncedValue in hooks/useAssets.ts.
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const queryFilters = {
    ...filters,
    search: debouncedSearch,
  };

  const { data, isLoading, isFetching } = useAssets(queryFilters, page, pageSize);

  // Table instance now lives in one place and is shared with the toolbar
  // (needed for the column-visibility toggle) and with the table itself.
  const { table, deleteAsset, selectedRows } = useAssetTable(data);

  const handleFiltersChange = useCallback((newFilters: AssetFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page on filter change
  }, []);

  const handleReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  // BUG FIX: previously hardcoded selectedCount={0} and onBulkDelete={() => {}}
  // with a "Will be wired from AssetTable" comment that was never completed,
  // so bulk delete silently did nothing. Now driven off the real table state.
  const handleBulkDelete = useCallback(() => {
    const ids = selectedRows.map((row) => row.original.id);
    if (ids.length === 0) return;

    Promise.all(ids.map((id) => deleteAsset.mutateAsync(id)))
      .then(() => {
        table.resetRowSelection();
        toast.success(`${ids.length} Asset(s) gelöscht`);
      })
      .catch(() => {
        toast.error("Löschen fehlgeschlagen, bitte erneut versuchen.");
      });
  }, [selectedRows, deleteAsset, table]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-muted-foreground">
            {isFetching && !isLoading ? "Aktualisierung..." : "Asset-Verwaltung und -Überwachung"}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <AssetStats />

      {/* Toolbar with search and filters */}
      <AssetToolbar
        table={table}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        selectedCount={selectedRows.length}
        onBulkDelete={handleBulkDelete}
      />

      {/* Main table */}
      <AssetTable
        table={table}
        data={data}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onFiltersReset={handleReset}
      />
    </div>
  );
}