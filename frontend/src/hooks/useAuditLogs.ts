/**
 * TanStack Query hook for audit logs with offset pagination.
 * Wired to real backend: GET /audit-logs/?limit=&offset=&actor=&action=&target_type=&date_from=&date_to=
 * @module hooks/useAuditLogs
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "#/lib/api";
import type { AuditLog, AuditLogFilters, PaginatedAuditLogList } from "#/types/audit-log";

const LIMIT = 25;

export function mapBackendItem(raw: unknown): AuditLog {
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

      if (filters.actor) {
        params.set("actor", filters.actor);
      }
      if (filters.action) {
        params.set("action", filters.action);
      }
      if (filters.resourceType) {
        params.set("target_type", filters.resourceType);
      }
      if (filters.startDate) {
        params.set("date_from", `${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        params.set("date_to", `${filters.endDate}T23:59:59`);
      }

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

export type { AuditLogFilters };