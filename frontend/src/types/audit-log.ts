/**
 * Audit Log domain types
 * Mirrors the backend Pydantic schema (AuditLogRead) for append-only audit records.
 * @module types/audit-log
 */

export type AuditAction =
  | "asset.created"
  | "asset.updated"
  | "asset.deleted"
  | "asset.scanned"
  | "onboarding.created"
  | "onboarding.updated"
  | "onboarding.retried"
  | "user.login"
  | "user.logout"
  | "user.permission_changed"
  | "report.generated"
  | "report.deleted";

export type ResourceType = "asset" | "onboarding" | "user" | "report";

export interface AuditLog {
  readonly id: string;
  readonly timestamp: string; // ISO 8601
  readonly actor: string;
  readonly action: string;
  readonly targetType: string | null; // backend: target_type
  readonly targetId: string | null;   // backend: target_id
  readonly payload: unknown;          // backend: payload (JSONB)
}

/**
 * Multi-select filters: UI allows multiple, but API sends first item only (Option B).
 */
export interface AuditLogFilters {
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string;   // YYYY-MM-DD
  readonly actors?: readonly string[];
  readonly actions?: readonly AuditAction[];
  readonly resourceTypes?: readonly ResourceType[];
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