// src/types/onboarding.ts
export type ProvisioningSource = "local" | "ldap" | "entra_id";
export type UserStatus = "active" | "offboarded";
export type OnboardingWorkflowStatus = "PENDING" | "AD_CREATING" | "EMAIL_SENDING" | "JIRA_CREATING" | "COMPLETED" | "FAILED";

export interface OnboardingRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  
  // Backend DB state
  user_status: UserStatus;
  provisioning_source: ProvisioningSource;
  external_id?: string | null;
  
  // Frontend UI / Workflow state (Assuming backend provides this or we track it optimistically)
  workflow_status: OnboardingWorkflowStatus;
  simulation_log: string[]; 
  
  created_at: string;
  updated_at: string | null;
}

export interface CreateOnboardingRequest {
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  provisioning_source: ProvisioningSource;
}