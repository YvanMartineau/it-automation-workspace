/**
 * Asset Dashboard Page
 * High-density data table with real-time updates, virtualization, and batch operations
 * @module pages/Assets/Index
 */

import { useState, useCallback } from "react";
import { useAssets, useDebouncedSearch } from "#/hooks/useAssets";
import { AssetStats } from "#/components/data-display/AssetStats";
import { AssetToolbar } from "#/components/data-display/AssetToolbar";
import { AssetTable } from "#/components/data-display/AssetTable";
import type { AssetFilters } from "#/types/asset";

const DEFAULT_FILTERS: AssetFilters = {
  search: "",
  status: "all",
  os: "all",
  department: "all",
  health: "all",
};

export default function AssetIndex() {
  const [filters, setFilters] = useState<AssetFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { debouncedValue: searchValue } = useDebouncedSearch(filters.search);

  const queryFilters = {
    ...filters,
    search: searchValue,
  };

  const { data, isLoading, isFetching } = useAssets(queryFilters, page, pageSize);

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
        filters={filters}
        onFiltersChange={handleFiltersChange}
        selectedCount={0} // Will be wired from AssetTable
        onBulkDelete={() => {}} // Will be wired from AssetTable
      />

      {/* Main table */}
      <AssetTable
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