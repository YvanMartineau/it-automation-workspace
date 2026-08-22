// src/types/onboarding.ts

export type ProvisioningSource = "local" | "ldap" | "entra_id";
export type UserStatus = "active" | "offboarded";
export type OnboardingWorkflowStatus = "PENDING" | "AD_CREATING" | "EMAIL_SENDING" | "JIRA_CREATING" | "COMPLETED" | "FAILED";

// Mirrors backend's OnboardedUserListItem exactly, including the
// serialization_alias on job_status -> workflow_status (see
// backend/schemas/onboard.py). Don't rename this back to job_status
// without also dropping that alias server-side, or the Kanban board
// silently stops matching any record again.
export interface OnboardedUserListItem {
  user_id: string;
  job_id?: string | null; // required for retry/offboard/stream calls
  external_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  status: UserStatus; // access state: active / offboarded
  workflow_status: OnboardingWorkflowStatus; // wire name for job_status — the Kanban column state
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