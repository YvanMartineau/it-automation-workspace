import { useState, useCallback, useRef } from "react";

export interface ScanState {
  readonly isScanning: boolean;
  readonly progress: number;
  readonly hostsScanned: number;
  readonly hostsFound: number;
  readonly totalHosts: number;
  readonly currentHost: string;
  readonly status: "idle" | "scanning" | "complete";
}

/**
 * Generates a random IP within the simulated Class C private range.
 */
function generateHostIP(): string {
  return `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
}

/**
 * Simulates a network scan with live progress updates.
 * Scans 50–150 hosts at ~70ms intervals with a ~35% discovery rate.
 */
export function useScanSimulation() {
  const [state, setState] = useState<ScanState>({
    isScanning: false,
    progress: 0,
    hostsScanned: 0,
    hostsFound: 0,
    totalHosts: 0,
    currentHost: "",
    status: "idle",
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startScan = useCallback(
    (onComplete?: (foundCount: number) => void) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      const totalHosts = Math.floor(Math.random() * 100) + 50; // 50–150 hosts
      let scanned = 0;
      let found = 0;

      setState({
        isScanning: true,
        progress: 0,
        hostsScanned: 0,
        hostsFound: 0,
        totalHosts,
        currentHost: "",
        status: "scanning",
      });

      intervalRef.current = setInterval(() => {
        scanned += 1;
        const currentHost = generateHostIP();
        const isFound = Math.random() < 0.35;

        if (isFound) {
          found += 1;
        }

        const progress = Math.round((scanned / totalHosts) * 100);

        setState({
          isScanning: true,
          progress,
          hostsScanned: scanned,
          hostsFound: found,
          totalHosts,
          currentHost,
          status: "scanning",
        });

        if (scanned >= totalHosts) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          setState((prev) => ({
            ...prev,
            isScanning: false,
            progress: 100,
            status: "complete",
          }));

          // Allow user to read 100% state before invoking callback
          setTimeout(() => {
            onComplete?.(found);
          }, 1200);
        }
      }, 70);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    },
    []
  );

  const cancelScan = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isScanning: false,
      status: "idle",
    }));
  }, []);

  return { state, startScan, cancelScan } as const;
}