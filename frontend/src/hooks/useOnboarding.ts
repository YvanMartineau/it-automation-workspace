// src/hooks/useOnboarding.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockOnboardingData, mockCreateOnboarding, mockRetryOnboarding } from "#/mocks/onboarding.mock";
import type { OnboardingRecord, CreateOnboardingRequest } from "#/types/onboard";
import { toast } from "sonner"; // Assuming shadcn/ui sonner is used

// TODO: Replace mock imports with real API calls (e.g., api.post('/onboarding', data)) when backend is ready.

export const useOnboardingList = () => {
  return useQuery<OnboardingRecord[]>({
    queryKey: ["onboarding", "list"],
    queryFn: async () => {
      // Simulate API fetch
      await new Promise((resolve) => setTimeout(resolve, 500));
      return mockOnboardingData;
    },
    // Polling to simulate realistic step progression from n8n
    refetchInterval: 5000, 
  });
};

export const useCreateOnboarding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOnboardingRequest) => mockCreateOnboarding(data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["onboarding", "list"] });
      const previousData = queryClient.getQueryData<OnboardingRecord[]>(["onboarding", "list"]);
      
      // Optimistic update
      const optimisticRecord: OnboardingRecord = {
        id: "temp-" + Date.now(),
        ...newData,
        status: "PENDING",
        simulationLog: ["Optimistic: Queued for processing..."],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      queryClient.setQueryData(["onboarding", "list"], (old: OnboardingRecord[] = []) => [...old, optimisticRecord]);
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
    mutationFn: (id: string) => mockRetryOnboarding(id),
    onSuccess: () => {
      toast.info("Onboarding-Schritt wird erneut ausgeführt...");
      queryClient.invalidateQueries({ queryKey: ["onboarding", "list"] });
    },
    onError: () => {
      toast.error("Fehler beim Wiederholen des Vorgangs.");
    },
  });
};