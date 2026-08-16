/**
 * TanStack Query hook for audit logs with cursor-based pagination.
 * Configured for low DB connection pressure (Aiven max_connections=20).
 * @module hooks/useAuditLogs
 */

import { useQuery } from "@tanstack/react-query";
import type {
  AuditLog,
  AuditLogFilters,
  AuditAction,
  ResourceType,
  PaginatedAuditLogList,
} from "#/types/audit-log";

const MOCK_ACTORS: readonly string[] = [
  "admin@company.de",
  "support@company.de",
  "system",
  "j.mueller@company.de",
  "k.schmidt@company.de",
];

const MOCK_ACTIONS: readonly AuditAction[] = [
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "asset.scanned",
  "onboarding.created",
  "onboarding.updated",
  "onboarding.retried",
  "user.login",
  "user.permission_changed",
  "report.generated",
];

const MOCK_RESOURCE_TYPES: readonly ResourceType[] = [
  "asset",
  "user",
  "onboarding",
  "report",
];

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Picks a random element from a non-empty array.
 * Safe under noUncheckedIndexedAccess because we verify bounds.
 */
function pickFromArray<T>(arr: readonly T[], seed: number): T {
  const index = Math.floor(seededRandom(seed) * arr.length);
  const item = arr[index];
  if (item === undefined) {
    throw new Error(`pickFromArray: index ${index} out of bounds for array length ${arr.length}`);
  }
  return item;
}

function generateMockAuditLogs(
  cursor: string | null,
  limit: number,
  filters: AuditLogFilters
): PaginatedAuditLogList {
  const baseSeed = cursor ? parseInt(cursor, 36) : Date.now();
  const data: AuditLog[] = [];

  for (let i = 0; i < limit; i++) {
    const seed = baseSeed + i;

    const action = pickFromArray(MOCK_ACTIONS, seed);
    const resourceType = pickFromArray(MOCK_RESOURCE_TYPES, seed + 1);
    const actor = pickFromArray(MOCK_ACTORS, seed + 2);

    // Multi-select filters: OR within category, AND across categories.
    // Empty array or undefined means "no filter" (show all).
    if (filters.actions && filters.actions.length > 0 && !filters.actions.includes(action)) {
      continue;
    }
    if (
      filters.resourceTypes &&
      filters.resourceTypes.length > 0 &&
      !filters.resourceTypes.includes(resourceType)
    ) {
      continue;
    }
    if (filters.actors && filters.actors.length > 0 && !filters.actors.includes(actor)) {
      continue;
    }

    const timestamp = new Date(
      Date.now() - Math.floor(seededRandom(seed + 3) * 30 * 24 * 60 * 60 * 1000)
    ).toISOString();

    if (filters.startDate && timestamp < `${filters.startDate}T00:00:00.000Z`) continue;
    if (filters.endDate && timestamp > `${filters.endDate}T23:59:59.999Z`) continue;

    const hasDiff = ["asset.updated", "onboarding.updated", "user.permission_changed"].includes(
      action
    );

    data.push({
      id: `audit-${seed.toString(36)}`,
      timestamp,
      actor,
      action,
      resourceType,
      resourceId: `${resourceType}-${Math.floor(seededRandom(seed + 4) * 10000)
        .toString()
        .padStart(4, "0")}`,
      ...(hasDiff
        ? {
            diff: {
              status: { old: "pending", new: "completed" },
              assignedTo: { old: "unassigned", new: actor },
            },
          }
        : {}),
      ipAddress: `10.0.${Math.floor(seededRandom(seed + 5) * 255)}.${Math.floor(
        seededRandom(seed + 6) * 255
      )}`,
    });
  }

  const nextCursor = data.length === limit ? (baseSeed + limit).toString(36) : null;

  return {
    data,
    meta: {
      nextCursor,
      hasMore: nextCursor !== null,
    },
  };
}

/**
 * Fetches a single page of audit logs using cursor pagination.
 * staleTime: 5m (audit logs are append-only, rarely change).
 * refetchOnWindowFocus: false (spec requirement for audit logs).
 */
export function useAuditLogs(filters: AuditLogFilters, cursor: string | null) {
  return useQuery<PaginatedAuditLogList, Error>({
    queryKey: ["audit-logs", filters, cursor],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return generateMockAuditLogs(cursor, 25, filters);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export { MOCK_ACTORS };
export type { AuditLogFilters };