// frontend/src/hooks/useAssets.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "#/lib/api";
import { deriveAssetHealth } from "#/lib/assetHealth";
import { ASSETS_QUERY_KEY, ASSET_STATS_QUERY_KEY} from "#/lib/constants";
import type { AssetFilters, PaginatedAssetList, AssetStats } from "#/types/asset";

/**
 * GET /devices — real backend call. Replaces the previous in-memory
 * MOCK_ASSETS generator entirely; that version built objects with
 * camelCase keys (hostname/ipAddress/macAddress/healthScore/specs) that
 * never matched the real Device shape (snake_case, no healthScore, no
 * specs, nullable open_ports).
 *
 * `filters.health` is DELIBERATELY NOT sent to the backend — it's
 * computed client-side (lib/assetHealth.ts) from status + cpu/memory
 * percent, which the backend can't filter on as a combined concept
 * without a SQL CASE expression that doesn't exist yet. This filters
 * AFTER the page arrives, which means with a health filter active, a
 * page can show fewer than `pageSize` rows, and the visible count can
 * look inconsistent with meta.totalItems. Flagged, not hidden.
 */
export function useAssets(filters: AssetFilters, page: number, pageSize: number) {
  return useQuery<PaginatedAssetList>({
    queryKey: [...ASSETS_QUERY_KEY, filters, page, pageSize],
    queryFn: async () => {
      const response = await api.get<PaginatedAssetList>("/devices/", {
        params: {
          status: filters.status === "all" ? undefined : filters.status,
          search: filters.search || undefined,
          os: filters.os === "all" || !filters.os ? undefined : filters.os,
          page,
          pageSize,
        },
      });

      if (filters.health === "all") return response.data;

      return {
        data: response.data.data.filter((asset) => deriveAssetHealth(asset) === filters.health),
        meta: response.data.meta, // see doc comment above: intentionally not recomputed
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * No dedicated backend aggregate endpoint exists, so this fetches up to
 * ASSET_STATS_SAMPLE_SIZE devices unfiltered and computes counts
 * client-side — see lib/constants.ts for the cap's limitation on very
 * large scanned subnets.
 */
export function useAssetStats() {
  return useQuery<AssetStats>({
    queryKey: ASSET_STATS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await api.get<AssetStats>("/devices/stats");
      return data;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Calls the real DELETE /devices/{id}. The previous version faked
 * success after a setTimeout with no actual API call, which is worse
 * than doing nothing: it showed a "deleted" toast and invalidated the
 * query while the device was still in the DB, so the very next refetch
 * silently brought it back.
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      await api.delete(`/devices/${assetId}`);
      return assetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSETS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_QUERY_KEY });
    },
    onError: () => {
      toast.error("Löschen fehlgeschlagen", { description: "Das Asset konnte nicht gelöscht werden." });
    },
  });
}

/**
 * Debounce any value by `delay` ms. Single source of truth: `filters.search`
 * is passed straight in, and the debounced value returned is what drives
 * the query — no separate internal copy that can go stale.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}