// src/hooks/useOnboarding.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "#/lib/api";
import { useAuthStore } from "#/hooks/useAuth";
import type {
  OnboardedUserListItem,
  OnboardRequest,
  OnboardJobStarted,
  OnboardingWorkflowStatus,
} from "#/types/onboarding";
import { toast } from "sonner";
import { AxiosError } from "axios";

export const useOnboardingList = () => {
  return useQuery<OnboardedUserListItem[]>({
    queryKey: ["onboard", "list"],
    queryFn: async () => {
      const response = await api.get<OnboardedUserListItem[]>("/onboard");
      return response.data;
    },
    // Safety-net poll only — while a job is in flight, its card gets live
    // updates from useOnboardingJobStream (SSE) instead. This interval
    // just covers a dropped stream (backgrounded tab, network blip) or a
    // job that was already running before this session started.
    refetchInterval: 20000,
  });
};

export const useCreateOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OnboardRequest) =>
      api.post<OnboardJobStarted>("/onboard", data).then((res) => res.data),

    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: ["onboard", "list"] });
      const previousData = queryClient.getQueryData<OnboardedUserListItem[]>(["onboard", "list"]) || [];

      const optimisticRecord: OnboardedUserListItem = {
        user_id: `temp-${Date.now()}`,
        job_id: `temp-job-${Date.now()}`,
        external_id: null,
        ...newData,
        status: "active",
        workflow_status: "PENDING",
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
      api.post<OnboardJobStarted>(`/onboard/jobs/${jobId}/retry`).then((res) => res.data),

    onSuccess: () => {
      toast.info("Onboarding-Schritt wird erneut ausgeführt...");
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },

    onError: (error: unknown) => {
      if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error("Dieser Vorgang kann nicht wiederholt werden (bereits abgeschlossen oder läuft).");
      } else {
        toast.error("Fehler beim Wiederholen des Vorgangs.");
      }
    },
  });
};

export const useOffboardUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.post(`/onboard/${userId}/offboard`).then((res) => res.data),

    onSuccess: () => {
      toast.success("Zugriff wurde erfolgreich widerrufen.");
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },

    onError: (error: unknown) => {
      if (error instanceof AxiosError && error.response?.status === 404) {
        toast.error("Nutzer wurde nicht gefunden.");
      } else {
        toast.error("Fehler beim Offboarding.");
      }
    },
  });
};

interface OnboardingJobStreamEvent {
  status: string;
  data?: { error?: string | null } & Record<string, unknown>;
}

/**
 * Subscribes to GET /onboard/jobs/{jobId}/stream (SSE) and patches the
 * matching record's workflow_status/error_message directly into the
 * ["onboard","list"] query cache as events arrive.
 *
 * Uses a manual fetch + ReadableStream reader instead of `EventSource`
 * because EventSource can't attach an Authorization header, and this
 * app's access token lives in memory rather than a cookie (see the note
 * in lib/api.ts) — this mirrors that file's Bearer-token attachment.
 */
export function useOnboardingJobStream(jobId: string | null | undefined, active: boolean) {
  const queryClient = useQueryClient();
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!jobId || !active) return;

    const controller = new AbortController();

    const applyEvent = (event: OnboardingJobStreamEvent) => {
      queryClient.setQueryData<OnboardedUserListItem[]>(["onboard", "list"], (prev) =>
        prev?.map((r) =>
          r.job_id === jobId
            ? {
                ...r,
                workflow_status: event.status as OnboardingWorkflowStatus,
                error_message: event.data?.error ?? r.error_message,
              }
            : r
        ) ?? prev
      );
      if (event.status === "COMPLETED" || event.status === "FAILED") {
        // Stream only carries status + error — refetch from Postgres to
        // pick up anything else that changed (external_id, etc).
        queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
      }
    };

    async function connect() {
      try {
        const token = useAuthStore.getState().user?.accessToken;
        const response = await fetch(`/api/onboard/jobs/${jobId}/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            try {
              const parsed: OnboardingJobStreamEvent = JSON.parse(dataLine.replace(/^data:\s*/, ""));
              applyEvent(parsed);
              if (parsed.status === "COMPLETED" || parsed.status === "FAILED") return;
            } catch {
              // skip malformed chunk rather than crash the reader
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error(`SSE stream for job ${jobId} failed`, err);
        }
      }
    }

    connect();
    return () => controller.abort();
  }, [jobId, active, queryClient]);
}