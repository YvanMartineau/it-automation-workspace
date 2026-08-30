// src/types/onboard.ts (Snippet to add) //USELESS WAS REPLACE BY onboarding.ts
export type OnboardingSource = 'local_db' | 'entra_id';
export type OnboardingStatus = 'PENDING' | 'AD_CREATING' | 'EMAIL_SENDING' | 'JIRA_CREATING' | 'PARTIALLY_COMPLETE' | 'COMPLETED' | 'FAILED';

export interface OnboardingRecord {
  id: string;
  name: string;
  department: string;
  role: string;
  status: OnboardingStatus;
  source: OnboardingSource;
  simulationLog: string[]; // Mock webhook payloads
  createdAt: string;
  updatedAt: string;
}

export interface CreateOnboardingRequest {
  name: string;
  department: string;
  role: string;
  source: OnboardingSource;
}