import { INITIAL_MOCK_REPORTS } from "./mockReports";

// Align with the mocked report status values without importing a non-exported type.
type ReportStatus = "processing" | "completed" | "failed";

type Report = {
  id: string;
  title: string;
  type: string;
  status: ReportStatus;
  generatedAt: string;
  generatedBy: string;
  fileSizeBytes?: number;
  downloadUrl?: string;
};

type GenerateReportInput = {
  title: string;
  type: string;
};

// Use the shared report type so generated items stay compatible with the mocked data model.
const DEFAULT_REPORT_STATUS: ReportStatus = "processing";

let mockStore: Report[] = [...INITIAL_MOCK_REPORTS];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockReportApi = {
  getReports: async (filters?: { type?: string; search?: string }): Promise<Report[]> => {
    await delay(400); // Simulate network latency

    let results = [...mockStore];

    if (filters?.type && filters.type !== "all") {
      results = results.filter((r) => r.type === filters.type);
    }

    if (filters?.search) {
      const query = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.generatedBy.toLowerCase().includes(query)
      );
    }

    return results;
  },

  generateReport: async (payload: GenerateReportInput): Promise<Report> => {
    await delay(800); // Simulate processing start delay

    const newReport: Report = {
      id: `rep-${Date.now().toString().slice(-4)}`,
      title: payload.title,
      type: payload.type,
      status: "processing",
      generatedAt: new Date().toISOString(),
      generatedBy: "Current User",
    };

    mockStore = [newReport, ...mockStore];

    // Simulate completion after 5 seconds
    setTimeout(() => {
      mockStore = mockStore.map((r) =>
        r.id === newReport.id
          ? {
              ...r,
              status: "completed",
              fileSizeBytes: 1024 * 1024 * (Math.floor(Math.random() * 5) + 1),
              downloadUrl: "#",
            }
          : r
      );
    }, 5000);

    return newReport;
  },
};