/**
 * Audit Log domain types
 * Mirrors the backend Pydantic schema (AuditLogRead).
 * @module types/audit-log
 */

export interface AuditLog {
  readonly id: string;
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly payload: unknown;
}

/**
 * Single-select filters.
 */
export interface AuditLogFilters {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly actor?: string;
  readonly action?: string;
  readonly resourceType?: string;
}

export interface OffsetPaginationMeta {
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface PaginatedAuditLogList {
  readonly data: readonly AuditLog[];
  readonly meta: OffsetPaginationMeta;
}