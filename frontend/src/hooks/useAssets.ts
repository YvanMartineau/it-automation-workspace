// frontend/src/hooks/useAssets.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";
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
  const statuses = ["online", "offline", "sleeping", ] as const;
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
 * Filter and paginate assets client-side
 * In production, this moves to the API with cursor pagination
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
 * Hook for debounced search input
 * 300ms debounce per spec performance constraints
 */
export function useDebouncedSearch(initialValue = "", delay = 300) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  return { value, debouncedValue, handleChange };
}