import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import { mockReportApi } from "#/lib/mockApi";
import { Report, GenerateReportInput } from "#/types/report";
import { toast } from "sonner";

// Set to false when FastAPI backend endpoint is ready
const USE_MOCK = true;

export function useReports(filters?: { type?: string; search?: string }) {
  return useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      if (USE_MOCK) {
        return mockReportApi.getReports(filters);
      }
      const response = await api.get<{ data: Report[] }>("/reports", { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Poll every 3s to refresh status if any report is in "processing" state
    refetchInterval: (query) => {
      const hasProcessing = query.state.data?.some((r) => r.status === "processing");
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: GenerateReportInput) => {
      if (USE_MOCK) {
        return mockReportApi.generateReport(payload);
      }
      const response = await api.post<{ data: Report }>("/reports/generate", payload);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Berichtserstellung erfolgreich gestartet.");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => {
      toast.error(`Fehler bei der Berichtserstellung: ${error.message}`);
    },
  });
}