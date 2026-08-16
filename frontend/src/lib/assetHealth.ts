// frontend/src/lib/assetHealth.ts
import type { Asset, AssetHealth } from "#/types/asset";

/**
 * Device Health model. See chat for full per-dimension reasoning; summary
 * of what does/doesn't feed the verdict, and why:
 *
 *  - status: PRIMARY signal. offline -> critical, unknown -> unknown.
 *  - cpu_percent / memory_percent: secondary, but ONLY evaluated when
 *    non-null — per scanner.py, these are populated exclusively for the
 *    scan host itself. Every other device has both as null forever;
 *    treating null as unhealthy would false-flag the whole fleet.
 *  - latency_ms: DELIBERATELY EXCLUDED. It's wall-clock nmap subprocess
 *    time (see models/device.py's column comment), not real network RTT,
 *    and gets contaminated by scan concurrency (Semaphore(50) in
 *    scanner.py). Shown as an informational column only, never gates
 *    Health — an earlier version of this file used a 150ms threshold
 *    here; reverted after tracing what the field actually measures.
 *  - open_ports, os_info: EXCLUDED entirely — see isDeviceExposed's
 *    sibling concept and AssetColumns.tsx for how these render instead
 *    (informational, uncolored).
 *  - last_seen: NOT folded in here — see isDeviceStale() below.
 */

const LOCAL_RESOURCE_WARNING_THRESHOLD = 90; // percent
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h — tune to your scan cadence

export function deriveAssetHealth(
  asset: Pick<Asset, "status" | "cpu_percent" | "memory_percent">
): AssetHealth {
  if (asset.status === "offline") return "critical";
  if (asset.status === "unknown") return "unknown";

  // Only ever true for the scan host itself — see doc comment above.
  const cpuHot = asset.cpu_percent !== null && asset.cpu_percent > LOCAL_RESOURCE_WARNING_THRESHOLD;
  const ramHot = asset.memory_percent !== null && asset.memory_percent > LOCAL_RESOURCE_WARNING_THRESHOLD;
  if (cpuHot || ramHot) return "warning";

  return "healthy";
}

/**
 * Separate, additive concept — a device can be healthy-but-stale (last
 * confirmed online 3 days ago, nothing has re-scanned since). Deliberately
 * NOT merged into deriveAssetHealth's return value; see table in chat.
 */
export function isDeviceStale(asset: Pick<Asset, "last_seen">, now: number = Date.now()): boolean {
  if (!asset.last_seen) return false;
  return now - new Date(asset.last_seen).getTime() > STALE_THRESHOLD_MS;
}