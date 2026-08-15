/**
 * Audit Log domain types
 * Mirrors the backend Pydantic schema for append-only audit records.
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

export interface AuditLogDiffEntry {
  readonly old: unknown;
  readonly new: unknown;
}

export interface AuditLog {
  readonly id: string;
  readonly timestamp: string; // ISO 8601
  readonly actor: string;
  readonly action: AuditAction;
  readonly resourceType: ResourceType;
  readonly resourceId: string;
  readonly diff?: Readonly<Record<string, AuditLogDiffEntry>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface AuditLogFilters {
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly actor?: string;
  readonly action: AuditAction | "all";
  readonly resourceType: ResourceType | "all";
}

export interface CursorPaginationMeta {
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export interface PaginatedAuditLogList {
  readonly data: readonly AuditLog[];
  readonly meta: CursorPaginationMeta;
}