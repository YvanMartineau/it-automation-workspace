// frontend/src/hooks/useScanStream.ts
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { api } from "#/lib/api";
import { openEventStream } from "#/lib/sse";
import { useAuthStore } from "#/hooks/useAuth";
import {
  scanStartResponseSchema,
  scanProgressDataSchema,
  scanCompleteDataSchema,
  scanErrorDataSchema,
} from "#/types/scan";

export interface ScanState {
  readonly isScanning: boolean;
  readonly progress: number;
  readonly hostsScanned: number;
  readonly totalHosts: number;
  /**
   * Real "found" (online) count. Deliberately null until `complete`
   * arrives — the backend's `progress` events don't carry a live
   * found-count (see ScanProgressData's note), so the UI should render a
   * placeholder rather than a misleading number mid-scan. Per team
   * decision: show the real number on completion only; don't patch the
   * backend to fake a live counter for this pass.
   */
  readonly hostsFound: number | null;
  readonly currentHost: string;
  readonly status: "idle" | "starting" | "scanning" | "complete" | "error";
  readonly errorMessage: string | null;
  /** Epoch ms until which starting a new scan should stay disabled (429 backoff). Null when no cooldown is active. */
  readonly cooldownUntil: number | null;
}

const IDLE_STATE: ScanState = {
  isScanning: false,
  progress: 0,
  hostsScanned: 0,
  totalHosts: 0,
  hostsFound: null,
  currentHost: "",
  status: "idle",
  errorMessage: null,
  cooldownUntil: null,
};

const ASSETS_QUERY_KEY = ["assets"] as const;
const ASSET_STATS_QUERY_KEY = ["assets", "stats"] as const;

/**
 * Real backend-driven replacement for useScanSimulation. Owns POST /scan,
 * the SSE connection to /scan/{job_id}/stream, and invalidating the
 * assets queries on completion so newly discovered devices show up.
 *
 * DELIBERATELY NOT tied to ScanDialog's lifecycle — call this from a
 * component that outlives the dialog (AssetToolbar), so closing the
 * dialog does not abort the SSE reader mid-scan. See job_store's
 * single-consumer-queue note in sse.ts for why losing the only reader is
 * lossy, not just inconvenient.
 *
 * SCOPE NOTE: this hook's state lives only as long as the component that
 * calls it stays mounted. Closing/reopening the scan dialog within the
 * Asset Dashboard page works fine. Navigating away from the page entirely
 * unmounts AssetToolbar (and this hook), which will stop showing progress
 * — the underlying fetch keeps running and still invalidates the asset
 * queries on completion, but any toast/live-progress UI is lost. True
 * persistence across navigation would mean lifting this hook to a
 * layout-level component (e.g. DashboardLayout) instead — flagging as an
 * open question rather than deciding it here.
 */
export function useScanStream() {
  const [state, setState] = useState<ScanState>(IDLE_STATE);
  const streamControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const closeStream = useCallback(() => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
  }, []);

  const startScan = useCallback(
    async (subnet: string) => {
      if (state.status === "starting" || state.status === "scanning") {
        return; // already running — caller should reopen the dialog instead
      }

      closeStream();
      setState({ ...IDLE_STATE, status: "starting" });

      try {
        const response = await api.post("/scan", { subnet });
        const parsed = scanStartResponseSchema.parse(response.data);

        setState((prev) => ({ ...prev, status: "scanning" }));

        const token = useAuthStore.getState().user?.accessToken;
        const streamUrl = `${api.defaults.baseURL}/scan/${parsed.job_id}/stream`;

        streamControllerRef.current = openEventStream(
          streamUrl,
          token ? { Authorization: `Bearer ${token}` } : {},
          {
            onFrame: (frame) => {
              if (frame.event === "progress") {
                const data = scanProgressDataSchema.parse(JSON.parse(frame.data));
                setState((prev) => ({
                  ...prev,
                  status: "scanning",
                  hostsScanned: data.hosts_scanned,
                  totalHosts: data.hosts_found, // see schema note: this is the subnet total, not a found-count
                  currentHost: data.current_host ?? "",
                  progress:
                    data.hosts_found > 0
                      ? Math.round((data.hosts_scanned / data.hosts_found) * 100)
                      : 0,
                }));
              } else if (frame.event === "complete") {
                const data = scanCompleteDataSchema.parse(JSON.parse(frame.data));
                setState((prev) => ({
                  ...prev,
                  status: "complete",
                  progress: 100,
                  hostsFound: data.online,
                  totalHosts: data.total_hosts,
                }));
                queryClient.invalidateQueries({ queryKey: ASSETS_QUERY_KEY });
                queryClient.invalidateQueries({ queryKey: ASSET_STATS_QUERY_KEY });
                closeStream();
              } else if (frame.event === "error") {
                const data = scanErrorDataSchema.parse(JSON.parse(frame.data));
                setState((prev) => ({ ...prev, status: "error", errorMessage: data.message }));
                closeStream();
              }
              // Unknown event names are ignored, not thrown on — forward
              // compatible with future event types.
            },
            onError: () => {
              setState((prev) => ({
                ...prev,
                status: "error",
                errorMessage:
                  "Verbindung zum Scan-Fortschritt unterbrochen. Der Scan läuft möglicherweise im Hintergrund weiter.",
              }));
            },
          }
        );
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfterHeader = error.response.headers?.["retry-after"];
          const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 15;
          setState({
            ...IDLE_STATE,
            status: "error",
            errorMessage: `Zu viele Scans gestartet. Bitte in ${retryAfterSeconds}s erneut versuchen.`,
            cooldownUntil: Date.now() + retryAfterSeconds * 1000,
          });
          return;
        }
        if (axios.isAxiosError(error) && error.response?.status === 403) {
          setState({
            ...IDLE_STATE,
            status: "error",
            errorMessage: "Admin-Rechte erforderlich, um einen Scan zu starten.",
          });
          return;
        }
        setState({
          ...IDLE_STATE,
          status: "error",
          errorMessage: "Scan konnte nicht gestartet werden.",
        });
      }
    },
    [state.status, closeStream, queryClient]
  );

  /** Reset to idle without touching an in-flight stream — used after the user has read a completed/errored result. */
  const dismissResult = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  return { state, startScan, dismissResult };
}