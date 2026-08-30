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
const WATCHED_JOBS_KEY = ["onboard", "watchedJobIds"] as const;

function addWatchedJob(queryClient: QueryClient, jobId: string) {
  queryClient.setQueryData<string[]>(WATCHED_JOBS_KEY, (prev = []) =>
    prev.includes(jobId) ? prev : [...prev, jobId]
  );
}

function removeWatchedJob(queryClient: QueryClient, jobId: string) {
  queryClient.setQueryData<string[]>(WATCHED_JOBS_KEY, (prev = []) => prev.filter((id) => id !== jobId));
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "PARTIALLY_COMPLETE"]);

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
        requested_by: "Current User",
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

interface RetryVariables {
  jobId: string;
  /**
   * Only meaningful for a PARTIALLY_COMPLETE resume. Ignored server-side
   * for a FAILED full re-run (that path always issues a fresh password
   * since no account exists yet to have a stale one). Defaults to true
   * so a FAILED retry needs no special-casing on the caller's part.
   */
  rotatePassword?: boolean;
}

export const useRetryOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, rotatePassword = true }: RetryVariables) =>
      api
        .post<OnboardJobStarted>(`/onboard/jobs/${jobId}/retry`, { rotate_password: rotatePassword })
        .then((res) => res.data),

    onSuccess: (data) => {
      toast.info("Onboarding-Vorgang wird erneut ausgeführt…");
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

/**
 * Hard delete — only legal server-side from FAILED or PARTIALLY_COMPLETE.
 * Deliberately a separate hook from useOffboardUser: rollback removes a
 * record that never became a real employee; offboard soft-deletes one
 * that did. Conflating the two in the UI is exactly what the backend's
 * state machine was redesigned to prevent.
 */
export const useRollbackOnboarding = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.post(`/onboard/${userId}/rollback`).then((res) => res.data),

    onSuccess: () => {
      toast.success("Vorgang wurde vollständig entfernt.");
      queryClient.invalidateQueries({ queryKey: ["onboard", "list"] });
    },

    onError: (error: unknown) => {
      if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error(
          "Rollback nicht möglich — Vorgang ist bereits abgeschlossen. Nutzen Sie stattdessen Offboarding."
        );
      } else if (error instanceof AxiosError && error.response?.status === 404) {
        toast.error("Nutzer wurde nicht gefunden.");
      } else {
        toast.error("Fehler beim Zurücksetzen des Vorgangs.");
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
      } else if (error instanceof AxiosError && error.response?.status === 409) {
        toast.error("Offboarding erfordert einen vollständig abgeschlossenen Onboarding-Vorgang.");
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
      if (TERMINAL_STATUSES.has(event.status)) {
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
              if (TERMINAL_STATUSES.has(parsed.status)) return;
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