/**
 * Asset Dashboard Page — Premium Edition
 * High-density data table with real-time updates, virtualization, and batch operations
 * @module pages/Assets/Index
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const debouncedSearch = useDebouncedValue(filters.search, 300);

  const queryFilters = {
    ...filters,
    search: debouncedSearch,
  };

  const { data, isLoading, isFetching } = useAssets(queryFilters, page, pageSize);
  const { table, deleteAsset, selectedRows } = useAssetTable(data);

  const handleFiltersChange = useCallback((newFilters: AssetFilters) => {
    setFilters(newFilters);
    setPage(1);
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

  const handleScanComplete = useCallback(
    (foundCount: number) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      if (foundCount > 0) {
        toast.success("Scan abgeschlossen", {
          description: `${foundCount} neue Assets entdeckt. Tabelle wird aktualisiert…`,
        });
      }
    },
    [queryClient]
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient sm:text-3xl">
            Assets
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1.5 max-w-xl leading-relaxed">
            {isFetching && !isLoading 
              ? "Aktualisierung läuft…" 
              : "Asset-Verwaltung und -Überwachung in Echtzeit."
            }
          </p>
        </div>
      </header>

      <AssetStats />

      <AssetToolbar
        table={table}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        selectedCount={selectedRows.length}
        onBulkDelete={handleBulkDelete}
        onScanComplete={handleScanComplete}
      />

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
