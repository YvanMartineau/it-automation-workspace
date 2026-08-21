// src/types/onboarding.ts

export type ProvisioningSource = "local" | "ldap" | "entra_id";
export type UserStatus = "active" | "offboarded";
export type OnboardingWorkflowStatus = "PENDING" | "AD_CREATING" | "EMAIL_SENDING" | "JIRA_CREATING" | "COMPLETED" | "FAILED";

// Mirrors backend's OnboardedUserListItem + job_id (see critical flag above)
export interface OnboardedUserListItem {
  user_id: string; // UUID from backend
  job_id?: string | null; // ⚠️ REQUIRED for retry endpoint. Add to backend schema if missing.
  external_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  status: UserStatus; // ACTIVE or OFFBOARDED (access state)
  job_status: OnboardingWorkflowStatus; // The actual Kanban column state
  provisioning_source: ProvisioningSource;
  requested_by: string | null;
  error_message: string | null;
  created_at: string;
  offboarded_at: string | null;
}

export interface OnboardRequest {
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
}

export interface OnboardJobStarted {
  job_id: string;
  status: string;
}