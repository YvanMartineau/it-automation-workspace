// src/hooks/useOnboarding.ts
import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
    // Safety-net poll for everything NOT actively streamed (other admins'
    // jobs, jobs from before this session). Actively-watched jobs get
    // live updates from useOnboardingJobStream instead.
    refetchInterval: 20000,
  });
};

// --- Watched-job-ids: a client-only cache slot, not a server query ---
// Holds only job_ids we ourselves just created/retried THIS session.
// That's the one case where the in-memory job_store on the backend is
// guaranteed to actually have the job — anything discovered from the
// list endpoint on page load might predate a server restart and 404
// forever, which is exactly what was flooding the console.
const WATCHED_JOBS_KEY = ["onboard", "watchedJobIds"] as const;

function addWatchedJob(queryClient: QueryClient, jobId: string) {
  queryClient.setQueryData<string[]>(WATCHED_JOBS_KEY, (prev = []) =>
    prev.includes(jobId) ? prev : [...prev, jobId]
  );
}

function removeWatchedJob(queryClient: QueryClient, jobId: string) {
  queryClient.setQueryData<string[]>(WATCHED_JOBS_KEY, (prev = []) => prev.filter((id) => id !== jobId));
}

export function useWatchedJobIds() {
  return useQuery<string[]>({
    queryKey: WATCHED_JOBS_KEY,
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

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

    onSuccess: (data) => {
      toast.success("Onboarding-Vorgang erfolgreich gestartet.");
      addWatchedJob(queryClient, data.job_id);
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },
  });
};

export const useRetryOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (jobId: string) =>
      api.post<OnboardJobStarted>(`/onboard/jobs/${jobId}/retry`).then((res) => res.data),

    onSuccess: (data) => {
      toast.info("Onboarding-Schritt wird erneut ausgeführt...");
      addWatchedJob(queryClient, data.job_id);
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
  data?: Record<string, unknown>;
}

/**
 * Subscribes to GET /onboard/jobs/{jobId}/stream (SSE) and patches the
 * matching record's workflow_status/error_message into the
 * ["onboard","list"] cache as events arrive. Removes jobId from the
 * watched list on a terminal status OR a 404 (job no longer exists in
 * the backend's in-memory store — most likely a server restart since
 * this job was created), so a dead job_id is never retried on the next
 * mount.
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
                error_message: (event.data?.error as string | undefined) ?? r.error_message,
              }
            : r
        ) ?? prev
      );
      if (event.status === "COMPLETED" || event.status === "FAILED") {
        removeWatchedJob(queryClient, jobId);
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

        if (response.status === 404) {
          // Job doesn't exist server-side (stale / pre-restart) — stop
          // trying on future mounts instead of repeating this forever.
          if (jobId) removeWatchedJob(queryClient, jobId);
          return;
        }
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