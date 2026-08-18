import { z } from "zod";

export type ReportType = "asset_inventory" | "health_audit" | "onboarding_summary" | "compliance_log";
export type ReportStatus = "completed" | "processing" | "failed";

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  generatedAt: string;
  generatedBy: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
}

export const reportTypeLabels: Record<ReportType, string> = {
  asset_inventory: "Asset Inventory Report",
  health_audit: "Device Health Audit",
  onboarding_summary: "Onboarding Workflow Summary",
  compliance_log: "Compliance & Security Audit Log",
};

// German localized validation errors per specification
export const generateReportSchema = z.object({
  title: z.string().min(3, { message: "Titel muss mindestens 3 Zeichen lang sein." }),
  type: z.enum(["asset_inventory", "health_audit", "onboarding_summary", "compliance_log"], {
    required_error: "Bitte wählen Sie einen Berichtstyp aus.",
  }),
  dateRange: z.object({
    startDate: z.string().min(1, { message: "Startdatum ist erforderlich." }),
    endDate: z.string().min(1, { message: "Enddatum ist erforderlich." }),
  }).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: "Das Startdatum muss vor dem Enddatum liegen.",
    path: ["startDate"],
  }),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;