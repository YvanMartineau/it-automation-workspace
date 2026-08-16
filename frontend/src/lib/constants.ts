// frontend/src/lib/constants.ts
export const ASSETS_QUERY_KEY = ["assets"] as const;
export const ASSET_STATS_QUERY_KEY = ["assets", "stats"] as const;

/**
 * Capped at the backend's own pageSize<=500 ceiling (routers/devices.py's
 * Query(..., le=500)). A single scan can discover up to 1,024 hosts
 * (scanner.py's documented /22 max), so AssetStats can under-count on a
 * fully-populated large subnet — flagged, not silently rounded away.
 * Revisit with a real GET /devices/stats aggregate endpoint if this
 * matters in practice.
 */
export const ASSET_STATS_SAMPLE_SIZE = 500;

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;