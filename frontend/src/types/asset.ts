// frontend/src/types/asset.ts
/**
 * Mirrors backend/schemas/device.py's DeviceRead exactly — snake_case
 * field names kept as-is (no camelCase translation), since this
 * project's real contract is generating types from /openapi.json via
 * openapi-typescript eventually; matching casing now means that swap is
 * type-compatible later, not a rename.
 *
 * `Asset` is kept as an alias for `Device` to avoid a mass rename across
 * AssetTable/AssetColumns/AssetToolbar/etc.
 */

export type DeviceStatus = "online" | "offline" | "unknown";

/**
 * DERIVED client-side — NOT a backend field. See lib/assetHealth.ts.
 * The backend has no numeric health score: cpu_percent/memory_percent
 * are populated ONLY for the machine running the scan itself (see
 * services/scanner.py's local-host enrichment), so a 0–100 score across
 * a fleet isn't something the current data model can produce.
 */
export type AssetHealth = "healthy" | "warning" | "critical" | "unknown";

export interface Device {
  id: string;
  hostname: string | null;
  ip_address: string;
  mac_address: string | null;
  status: DeviceStatus;
  cpu_percent: number | null;
  memory_percent: number | null;
  os_info: string | null;
  latency_ms: number | null;
  open_ports: { port: number; service: string }[] | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string | null;
}

export type Asset = Device;

export interface AssetFilters {
  search: string;
  status: DeviceStatus | "all";
  /** Free-text substring against os_info — not a fixed enum. See device_service.py's list_devices_paginated. */
  os: string;
  health: AssetHealth | "all";
}

export interface AssetStats {
  total: number;
  online: number;
  offline: number;
  /** critical + warning (see deriveAssetHealth) — not the same set as `offline` alone. */
  healthAlerts: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface PaginatedAssetList {
  data: Asset[];
  meta: PaginationMeta;
}