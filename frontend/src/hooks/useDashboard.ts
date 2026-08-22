/**
 * @fileoverview TanStack Query hook for the aggregated dashboard snapshot.
 * Single GET /dashboard round-trip backing the Dashboard page — see
 * backend/routers/dashboard.py and backend/services/dashboard.py.
 *
 * Response field names are camelCase to match backend/schemas/dashboard.py
 * exactly, and reuse the SAME types the existing chart components already
 * import from '#/lib/mock-data' — so no mapping layer is needed here.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '#/lib/api';
import type {
  DashboardStats,
  HealthTrendDataPoint,
  OSDistributionItem,
  OnboardingVolumeDataPoint,
  AuditActivityItem,
} from '#/lib/mock-data';

const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

// Matches the 30s TTL of DashboardService.get_snapshot_cached(), if/when
// the router is switched to use it — polling faster than that would just
// re-request the same cached snapshot.
const DASHBOARD_REFETCH_INTERVAL_MS = 30_000;

export interface DashboardSnapshot {
  readonly stats: DashboardStats;
  readonly healthTrend: readonly HealthTrendDataPoint[];
  readonly osDistribution: readonly OSDistributionItem[];
  readonly onboardingVolume: readonly OnboardingVolumeDataPoint[];
  readonly auditActivity: readonly AuditActivityItem[];
  readonly generatedAt: string;
}

async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const { data } = await api.get<DashboardSnapshot>('/dashboard');
  return data;
}

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardSnapshot,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL_MS,
    staleTime: DASHBOARD_REFETCH_INTERVAL_MS,
  });
}