// src/types/onboarding.ts

export type ProvisioningSource = "local" | "ldap" | "entra_id";
export type UserStatus = "active" | "offboarded";
export type OnboardingWorkflowStatus =
  | "PENDING"
  | "AD_CREATING"
  | "EMAIL_SENDING"
  | "JIRA_CREATING"
  | "PARTIALLY_COMPLETE"
  | "COMPLETED"
  | "FAILED";

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

export interface OnboardedUserListItem {
  user_id: string;
  job_id: string | null;
  external_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  status: "active" | "offboarded";
  workflow_status: OnboardingWorkflowStatus;
  provisioning_source: "local" | "ldap" | "entra_id";
  requested_by: string | null;
  error_message: string | null;
  created_at: string;
  offboarded_at: string | null;
}