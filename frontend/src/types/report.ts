import { z } from "zod";

export type ReportType =
  | "overview"
  | "asset_inventory"
  | "device_health"
  | "onboarding_summary"
  | "compliance_audit";

export type JobStatus = "queued" | "running" | "completed" | "failed";

// Matches ReportJobResponse from backend/schemas/report.py
export interface ReportJobResponse {
  job_id: string;
  status: JobStatus;
  error_message?: string | null;
}

// Matches ReportRead from backend/schemas/report.py
export interface ReportRead {
  id: string;
  report_name: string;
  report_type: string;
  triggered_by: string;
  recipient_emails: string;
  status: string;
  sent_at: string;
  error_message?: string | null;
}

export const reportTypeLabels: Record<ReportType, string> = {
  overview: "System Overview Report",
  asset_inventory: "Asset Inventory Report",
  device_health: "Device Health Audit",
  onboarding_summary: "Onboarding Workflow Summary",
  compliance_audit: "Compliance & Security Audit Log",
};

export const reportTriggerSchema = z
  .object({
    report_type: z.enum(
      [
        "overview",
        "asset_inventory",
        "device_health",
        "onboarding_summary",
        "compliance_audit",
      ],
      {
        required_error: "Bitte wählen Sie einen Berichtstyp aus.",
      }
    ),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date);
      }
      return true;
    },
    {
      message: "Das Startdatum muss vor dem Enddatum liegen.",
      path: ["start_date"],
    }
  );

export type ReportTriggerInput = z.infer<typeof reportTriggerSchema>;