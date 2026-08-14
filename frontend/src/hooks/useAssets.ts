// frontend/src/hooks/useAssets.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { Asset, AssetFilters, PaginatedAssetList, AssetStats } from "#/types/asset";

/**
 * Index into a non-empty readonly array using modulo, guaranteeing an in-bounds
 * result. TypeScript's noUncheckedIndexedAccess can't prove `i % arr.length`
 * stays in bounds from the expression alone, so this centralizes the one
 * justified non-null assertion instead of repeating `!` at every call site.
 */
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]!;
}

// Mock data generator for development
const MOCK_ASSETS: Asset[] = Array.from({ length: 1250 }, (_, i) => {
  const cpus = ["100%", "89%", "42%", "25%", "10%"];
  const rams = ["100%", "32%", "64%", "8%", "90%"];
  const storages = ["200/512GB", "500/1TB", "1/2TB", "23/256GB", "3.9/4TB"];
  const oss = ["Windows", "Linux", "macOS", "iOS", "Android", "Other"] as const;
  const statuses = ["online", "offline", "sleeping"] as const;
  const osVersions = ["11", "22.04", "14.2", "17.1", "13", "1.0"];
  const hostPrefixes = ["web", "db", "app", "mail", "file"];

  return {
    id: `asset_${String(i + 1).padStart(6, "0")}`,
    hostname: `host-${pick(hostPrefixes, i)}-${Math.floor(i / 5) + 1}.corp.local`,
    ipAddress: `192.168.${Math.floor(i / 256)}.${i % 256}`,
    macAddress: `00:1A:2B:${String(Math.floor(i / 65536)).padStart(2, "0")}:${String(Math.floor((i % 65536) / 256)).padStart(2, "0")}:${String(i % 256).padStart(2, "0")}`,
    os: pick(oss, i),
    osVersion: pick(osVersions, i),
    lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    healthScore: Math.floor(Math.random() * 100),
    status: pick(statuses, i),
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    specs: {
      cpu: pick(cpus, i),
      ram: pick(rams, i),
      storage: pick(storages, i),
    },
  };
});

const ASSETS_QUERY_KEY = ["assets"] as const;
const ASSET_STATS_QUERY_KEY = ["assets", "stats"] as const;

/**
 * Filter and paginate assets client-side.
 *
 * NOTE (flagged, see chat): this runs against the full in-memory mock array,
 * which is fine at 1,250 rows. Once `lib/api.ts` is wired to the real
 * backend, this filtering step is what should move server-side (per your
 * "frontend first, then backend on request" instruction) — the frontend
 * should keep doing instant client-side filtering only against whatever
 * page/window of data it already has, not against the full table.
 *
 * `filters.department` is intentionally not applied here: `Asset` has no
 * `department` field and the toolbar has no department control wired up.
 * Flagged separately — needs a decision, not a silent guess.
 */
function filterAssets(assets: Asset[], filters: AssetFilters): Asset[] {
  return assets.filter((asset) => {
    const matchesSearch =
      filters.search === "" ||
      asset.hostname.toLowerCase().includes(filters.search.toLowerCase()) ||
      asset.ipAddress.includes(filters.search) ||
      asset.macAddress.toLowerCase().includes(filters.search.toLowerCase());

    const matchesStatus = filters.status === "all" || asset.status === filters.status;
    const matchesOS = filters.os === "all" || asset.os === filters.os;
    const matchesHealth = filters.health === "all" ||
      (filters.health === "healthy" && asset.healthScore >= 80) ||
      (filters.health === "warning" && asset.healthScore >= 50 && asset.healthScore < 80) ||
      (filters.health === "critical" && asset.healthScore < 50) ||
      (filters.health === "unknown" && asset.healthScore === 0);

    return matchesSearch && matchesStatus && matchesOS && matchesHealth;
  });
}

/**
 * Hook for asset list with filtering, sorting, and pagination
 * StaleTime: 30s for asset list per spec
 */
export function useAssets(filters: AssetFilters, page: number, pageSize: number) {
  return useQuery<PaginatedAssetList>({
    queryKey: [...ASSETS_QUERY_KEY, filters, page, pageSize],
    queryFn: async () => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      const filtered = filterAssets(MOCK_ASSETS, filters);
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      return {
        data: filtered.slice(start, end),
        meta: {
          page,
          pageSize,
          totalPages: Math.ceil(filtered.length / pageSize),
          totalItems: filtered.length,
        },
      };
    },
    staleTime: 30_000, // 30s per spec
    gcTime: 5 * 60_000, // 5m cache
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook for asset statistics cards
 * StaleTime: 30s per spec
 */
export function useAssetStats() {
  return useQuery<AssetStats>({
    queryKey: ASSET_STATS_QUERY_KEY,
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));

      return {
        total: MOCK_ASSETS.length,
        online: MOCK_ASSETS.filter((a) => a.status === "online").length,
        offline: MOCK_ASSETS.filter((a) => a.status === "offline").length,
        healthAlerts: MOCK_ASSETS.filter((a) => a.healthScore < 50).length,
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * Hook for optimistic asset deletion
 */
export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      return assetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSETS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ASSET_STATS_QUERY_KEY });
    },
  });
}

/**
 * Debounce any value by `delay` ms. Unlike the previous `useDebouncedSearch`,
 * this hook does NOT keep its own separate copy of the source value — it
 * only ever tracks a delayed derivative of whatever `value` you pass in.
 *
 * BUG THIS REPLACES: the old `useDebouncedSearch(initialValue)` seeded its
 * internal state from `initialValue` only once on mount (`useState(initialValue)`),
 * and exposed a `handleChange` setter that nothing ever called — the caller
 * in Index.tsx only read `debouncedValue` back out. Since the search <input>
 * updated `filters.search` directly (bypassing the hook entirely),
 * `debouncedValue` stayed frozen at its mount-time value ("") forever, so the
 * search filter silently never took effect. Confirmed with an isolated
 * repro: typing a hostname into the search box left the result count at the
 * full unfiltered 1,250/50-pages total.
 *
 * Fix: single source of truth. `filters.search` (already updated instantly
 * on every keystroke by the toolbar) is passed straight into this hook, and
 * the debounced value it returns is what actually drives the query.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debouncedValue;
}