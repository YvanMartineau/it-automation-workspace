import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import { ReportJobResponse, ReportRead, ReportTriggerInput } from "#/types/report";
import { toast } from "sonner";

/**
 * Fetch report history (GET /reports/history)
 */
export function useReportHistory() {
  return useQuery({
    queryKey: ["reports", "history"],
    queryFn: async () => {
      const response = await api.get<ReportRead[]>("/reports/history");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Poll job status until completed or failed (GET /reports/{job_id}/status)
 */
export function useReportJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["reports", "job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await api.get<ReportJobResponse>(`/reports/${jobId}/status`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Updated enum status: "queued" or "running"
      if (status === "queued" || status === "running") {
        return 1500;
      }
      return false;
    },
  });
}

/**
 * Trigger background task (POST /reports/trigger)
 */
export function useTriggerReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReportTriggerInput) => {
      // ISO strings conversion for datetime field compatibility
      const formattedPayload = {
        ...payload,
        start_date: payload.start_date ? new Date(payload.start_date).toISOString() : undefined,
        end_date: payload.end_date ? new Date(payload.end_date).toISOString() : undefined,
      };
      const response = await api.post<ReportJobResponse>("/reports/trigger", formattedPayload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Berichtserstellung erfolgreich gestartet.");
      queryClient.invalidateQueries({ queryKey: ["reports", "history"] });
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Starten der Berichtserstellung: ${error.message}`);
    },
  });
}

/**
 * Download generated PDF blob (GET /reports/{job_id}/download)
 */
export function useDownloadReport() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await api.get<Blob>(`/reports/${jobId}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report_${jobId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success("Bericht erfolgreich heruntergeladen.");
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Herunterladen des Berichts: ${error.message}`);
    },
  });
}