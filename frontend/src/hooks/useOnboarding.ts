// src/hooks/useOnboarding.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import type { OnboardingRecord, CreateOnboardingRequest } from "#/types/onboarding";
import { toast } from "sonner";

// NOTE: Adjust response.data to response.data.data if your backend wraps responses in { data: T, meta: ... }

export const useOnboardingList = () => {
  return useQuery<OnboardingRecord[]>({
    queryKey: ["onboarding", "list"],
    queryFn: async () => {
      const response = await api.get<OnboardingRecord[]>("/onboarding");
      return response.data;
    },
    // Polling to track realistic step progression from n8n webhooks
    refetchInterval: 5000, 
  });
};

export const useCreateOnboarding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateOnboardingRequest) => 
      api.post<OnboardingRecord>("/onboarding", data).then(res => res.data),
      
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["onboarding", "list"] });
      const previousData = queryClient.getQueryData<OnboardingRecord[]>(["onboarding", "list"]) || [];
      
      // Optimistic update for instant UI feedback
      const optimisticRecord: OnboardingRecord = {
        id: `temp-${Date.now()}`,
        ...newData,
        user_status: "active",
        workflow_status: "PENDING",
        simulation_log: ["Optimistisch: In Warteschlange..."],
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      
      queryClient.setQueryData(["onboarding", "list"], [...previousData, optimisticRecord]);
      return { previousData };
    },
    
    onError: (err, newData, context) => {
      queryClient.setQueryData(["onboarding", "list"], context?.previousData);
      toast.error("Fehler beim Erstellen des Onboarding-Vorgangs.");
    },
    
    onSuccess: () => {
      toast.success("Onboarding-Vorgang erfolgreich gestartet.");
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] });
    },
  });
};

export const useRetryOnboarding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => 
      api.post<OnboardingRecord>(`/onboarding/${id}/retry`).then(res => res.data),
      
    onSuccess: () => {
      toast.info("Onboarding-Schritt wird erneut ausgeführt...");
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] });
    },
    
    onError: () => {
      toast.error("Fehler beim Wiederholen des Vorgangs.");
    },
  });
};