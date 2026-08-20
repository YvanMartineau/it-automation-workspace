import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import { Report, GenerateReportInput } from "#/types/report";
import { toast } from "sonner";

export interface ReportQueryParams {
  type?: string;
  search?: string;
}

export function useReports(filters?: ReportQueryParams) {
  return useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      const response = await api.get<{ data: Report[] }>("/reports", {
        params: filters,
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (prevents excessive DB hits on Aiven)
    gcTime: 10 * 60 * 1000,    // 10 minutes
    refetchOnWindowFocus: false,
    // Automatically poll every 3 seconds if any report is in "processing" state
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