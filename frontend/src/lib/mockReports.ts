type ReportType =
  | "asset_inventory"
  | "health_audit"
  | "onboarding_summary"
  | "compliance_log";

type ReportStatus = "completed" | "processing" | "failed";

interface Report {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  generatedAt: string;
  generatedBy: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
}

export const INITIAL_MOCK_REPORTS: Report[] = [
  {
    id: "rep-001",
    title: "Q2 Asset Inventory & Lifecycle Status",
    type: "asset_inventory",
    status: "completed",
    generatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    generatedBy: "System Administrator",
    fileSizeBytes: 2450000, // ~2.45 MB
    downloadUrl: "#",
  },
  {
    id: "rep-002",
    title: "Infrastructure Health & Metric Audit",
    type: "health_audit",
    status: "completed",
    generatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    generatedBy: "IT Support Lead",
    fileSizeBytes: 5120000, // ~5.12 MB
    downloadUrl: "#",
  },
  {
    id: "rep-003",
    title: "Monthly Employee Onboarding Summary",
    type: "onboarding_summary",
    status: "processing",
    generatedAt: new Date().toISOString(),
    generatedBy: "Automated Workflow",
  },
  {
    id: "rep-004",
    title: "ISO 27001 Security & Access Audit Log",
    type: "compliance_log",
    status: "completed",
    generatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    generatedBy: "Security Officer",
    fileSizeBytes: 12800000, // ~12.8 MB
    downloadUrl: "#",
  },
  {
    id: "rep-005",
    title: "Legacy Workstation Patch Compliance",
    type: "health_audit",
    status: "failed",
    generatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    generatedBy: "System Administrator",
  },
];