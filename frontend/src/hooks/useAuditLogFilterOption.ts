/**
 * Distinct filter values derived from backend audit logs.
 * @module hooks/useAuditLogFilterOptions
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "#/lib/api";
import { mapBackendItem } from "./useAuditLogs";

export interface AuditLogFilterOptions {
  readonly actors: readonly string[];
  readonly actions: readonly string[];
  readonly targetTypes: readonly string[];
}

export function useAuditLogFilterOptions() {
  return useQuery<AuditLogFilterOptions, Error>({
    queryKey: ["audit-log-filter-options"],
    queryFn: async () => {
      const response = await api.get<unknown[]>("/audit-logs/?limit=500&offset=0");
      const logs = response.data.map(mapBackendItem);

      const actors = [...new Set(logs.map((l) => l.actor))].sort();
      const actions = [...new Set(logs.map((l) => l.action))].sort();
      const targetTypes = [
        ...new Set(logs.map((l) => l.targetType).filter((t): t is string => t !== null)),
      ].sort();

      return { actors, actions, targetTypes };
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}