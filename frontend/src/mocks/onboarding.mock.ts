// src/mocks/onboarding.mock.ts
import type { OnboardingRecord, OnboardingStatus, CreateOnboardingRequest } from "#types/onboarding.ts";

const MOCK_DELAY = 800; // Simulate network latency

const generateSimulationLog = (name: string, department: string, status: OnboardingStatus): string[] => {
  const logs: string[] = [];
  if (status !== 'PENDING') {
    logs.push(`POST https://n8n.instance.com/webhook/onboarding-start\nPayload: { "name": "${name}", "department": "${department}", "action": "init" }`);
  }
  if (status === 'AD_CREATING' || status === 'EMAIL_SENDING' || status === 'JIRA_CREATING' || status === 'COMPLETED') {
    logs.push(`POST https://n8n.instance.com/webhook/ad-create\nPayload: { "user": "${name}", "ou": "${department}" }`);
  }
  if (status === 'EMAIL_SENDING' || status === 'JIRA_CREATING' || status === 'COMPLETED') {
    logs.push(`POST https://n8n.instance.com/webhook/email-send\nPayload: { "to": "${name.toLowerCase().replace(' ', '.')}@company.com", "template": "welcome" }`);
  }
  if (status === 'JIRA_CREATING' || status === 'COMPLETED') {
    logs.push(`POST https://n8n.instance.com/webhook/jira-ticket\nPayload: { "summary": "IT Setup for ${name}", "priority": "High" }`);
  }
  if (status === 'FAILED') {
    logs.push(`ERROR: Webhook failed with 500 Internal Server Error at JIRA_CREATING step.`);
  }
  return logs;
};

export const mockOnboardingData: OnboardingRecord[] = [
  {
    id: "1",
    name: "Max Mustermann",
    department: "Engineering",
    role: "Software Engineer",
    status: "COMPLETED",
    source: "local_db",
    simulationLog: generateSimulationLog("Max Mustermann", "Engineering", "COMPLETED"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Julia Schmidt",
    department: "Marketing",
    role: "Marketing Manager",
    status: "JIRA_CREATING",
    source: "local_db",
    simulationLog: generateSimulationLog("Julia Schmidt", "Marketing", "JIRA_CREATING"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Thomas Weber",
    department: "Sales",
    role: "Sales Representative",
    status: "FAILED",
    source: "local_db",
    simulationLog: generateSimulationLog("Thomas Weber", "Sales", "FAILED"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const mockCreateOnboarding = async (data: CreateOnboardingRequest): Promise<OnboardingRecord> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const newRecord: OnboardingRecord = {
    id: Math.random().toString(36).substring(7),
    ...data,
    status: "PENDING",
    simulationLog: generateSimulationLog(data.name, data.department, "PENDING"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockOnboardingData.push(newRecord);
  return newRecord;
};

export const mockRetryOnboarding = async (id: string): Promise<OnboardingRecord> => {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY));
  const record = mockOnboardingData.find((r) => r.id === id);
  if (record) {
    record.status = "AD_CREATING"; // Reset to first step on retry
    record.simulationLog = [...record.simulationLog, `\n--- RETRY INITIATED ---`];
    record.updatedAt = new Date().toISOString();
  }
  return record!;
};