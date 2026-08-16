/**
 * TanStack Query hook for audit logs with offset pagination.
 * Wired to real backend: GET /audit-logs/?limit=&offset=&actor=&action=&target_type=&date_from=&date_to=
 * @module hooks/useAuditLogs
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "#/lib/api";
import type { AuditLog, AuditLogFilters, PaginatedAuditLogList } from "#/types/audit-log";

const LIMIT = 25;

const MOCK_ACTORS: readonly string[] = [
  "admin@company.de",
  "support@company.de",
  "system",
  "j.mueller@company.de",
  "k.schmidt@company.de",
];

function mapBackendItem(raw: unknown): AuditLog {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    timestamp: String(r.timestamp ?? ""),
    actor: String(r.actor ?? ""),
    action: String(r.action ?? ""),
    targetType:
      r.target_type !== undefined && r.target_type !== null
        ? String(r.target_type)
        : null,
    targetId:
      r.target_id !== undefined && r.target_id !== null
        ? String(r.target_id)
        : null,
    payload: r.payload ?? null,
  };
}

export function useAuditLogs(filters: AuditLogFilters, offset: number) {
  return useQuery<PaginatedAuditLogList, Error>({
    queryKey: ["audit-logs", filters, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));

      const firstActor = filters.actors?.[0];
      if (firstActor !== undefined) {
        params.set("actor", firstActor);
      }

      const firstAction = filters.actions?.[0];
      if (firstAction !== undefined) {
        params.set("action", firstAction);
      }

      const firstResourceType = filters.resourceTypes?.[0];
      if (firstResourceType !== undefined) {
        params.set("target_type", firstResourceType);
      }

      if (filters.startDate) {
        params.set("date_from", `${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        params.set("date_to", `${filters.endDate}T23:59:59`);
      }

      // CRITICAL FIX: trailing slash to avoid FastAPI 307 redirect that drops auth headers
      const response = await api.get<unknown[]>(`/audit-logs/?${params.toString()}`);
      const data = response.data.map(mapBackendItem);

      return {
        data,
        meta: {
          offset,
          limit: LIMIT,
          hasMore: data.length === LIMIT,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export { MOCK_ACTORS };
export type { AuditLogFilters };