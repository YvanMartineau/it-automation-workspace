//frontend/src/types/asset.ts
export type AssetStatus = "online" | "offline" | "sleeping";
export type AssetHealth = "healthy" | "warning" | "critical" | "unknown";
export type OSType = "Windows" | "Linux" | "macOS" | "iOS" | "Android" | "Other";

export interface Asset {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  os: OSType;
  osVersion: string;
  lastSeen: string; // ISO 8601
  healthScore: number; // 0-100
  status: AssetStatus;
  createdAt: string;
  updatedAt: string;
  specs: {
    cpu: string;
    ram: string;
    storage: string;
  };
}

export interface AssetFilters {
  search: string;
  status: AssetStatus | "all";
  os: OSType | "all";
  health: AssetHealth | "all";
}

export interface AssetStats {
  total: number;
  online: number;
  offline: number;
  healthAlerts: number;
}

export interface PaginatedAssetList {
  data: Asset[];
  meta: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}
