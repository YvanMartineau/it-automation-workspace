import { renderHook, waitFor } from "@testing-library/react";
import { createElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { api } from "../../../src/lib/api";
import { useAuditLogs } from "../../../src/hooks/useAuditLogs";

// Minimal type for the audit log entry (adjust to your actual model)
type AuditLog = { id: number };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return createElement(QueryClientProvider, { client }, children);
}

describe("Integration – useAuditLogs", () => {
  test("maps backend params correctly", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: 1 }] as AuditLog[],
    });

    renderHook(
      () => useAuditLogs({ actor: "admin", action: "", resourceType: "", startDate: "", endDate: "" }, 0),
      { wrapper }
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining("/audit-logs"),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 25,
            offset: 0,
            actor: "admin",
          }),
        })
      );
    });

    request.mockRestore();
  });

  test("returns placeholderData while loading", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: 1 }] as AuditLog[],
    });

    const { result } = renderHook(
      () => useAuditLogs({}, 0),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data?.data.length).toBe(1);
    });

    vi.restoreAllMocks();
  });
});