// src/hooks/useOnboarding.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "#/lib/api";
import type { OnboardedUserListItem, OnboardRequest, OnboardJobStarted } from "#/types/onboarding";
import { toast } from "sonner";
import { AxiosError } from "axios";

export const useOnboardingList = () => {
  return useQuery<OnboardedUserListItem[]>({
    queryKey: ["onboard", "list"],
    queryFn: async () => {
      const response = await api.get<OnboardedUserListItem[]>("/onboard");
      return response.data;
 },
    // Polling every 5s to match backend workflow progression
    refetchInterval: 5000,
  });
};

export const useCreateOnboarding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: OnboardRequest) => 
      api.post<OnboardJobStarted>("/onboard", data).then(res => res.data),
      
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["onboard", "list"] });
      const previousData = queryClient.getQueryData<OnboardedUserListItem[]>(["onboard", "list"]) || [];
      
      // Optimistic update for instant UI feedback
      const optimisticRecord: OnboardedUserListItem = {
        user_id: `temp-${Date.now()}`,
        job_id: `temp-job-${Date.now()}`,
        external_id: null,
        ...newData,
        status: "active",
        job_status: "PENDING",
        provisioning_source: "local",
        requested_by: "Current User", // Ideally from auth store
        error_message: null,
        created_at: new Date().toISOString(),
        offboarded_at: null,
      };
      
      queryClient.setQueryData(["onboard", "list"], [...previousData, optimisticRecord]);
      return { previousData };
    },
    
    onError: (_error, _newData, context) => {
      queryClient.setQueryData(["onboard", "list"], context?.previousData);
      toast.error("Fehler beim Erstellen des Onboarding-Vorgangs.");
    },
    
    onSuccess: () => {
      toast.success("Onboarding-Vorgang erfolgreich gestartet.");
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },
  });
};

export const useRetryOnboarding = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (jobId: string) => 
      api.post<OnboardJobStarted>(`/onboard/jobs/${jobId}/retry`).then(res => res.data),
      
    onSuccess: () => {
      toast.info("Onboarding-Schritt wird erneut ausgeführt...");
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },
    
    onError: (error: unknown) => { // 👈 CHANGE 'any' TO 'unknown'
      // 👈 USE TYPE GUARD TO SAFELY ACCESS AXIOS PROPERTIES
      if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error("Dieser Vorgang kann nicht wiederholt werden (bereits abgeschlossen oder läuft).");
      } else {
        toast.error("Fehler beim Wiederholen des Vorgangs.");
      }
    },
  });
};