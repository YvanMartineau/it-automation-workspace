import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import { Report, GenerateReportInput } from "#/types/report";
import { toast } from "sonner";

export function useReports(filters?: { type?: string; search?: string }) {
  return useQuery({
    queryKey: ["reports", filters],
    queryFn: async () => {
      const response = await api.get<{ data: Report[] }>("/reports", { params: filters });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes (formerly cacheTime in v5)
    refetchOnWindowFocus: false,
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