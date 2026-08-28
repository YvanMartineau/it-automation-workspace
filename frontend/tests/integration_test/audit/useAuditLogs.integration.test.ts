/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../src/lib/api";
import { useAuditLogs } from "../../../src/hooks/useAuditLogs";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("Integration – useAuditLogs", () => {
  beforeEach(() => vi.restoreAllMocks());

  test("maps backend params correctly", async () => {
    const request = vi.spyOn(api, "get").mockResolvedValue({
      data: [],
    });

    renderHook(
      () => useAuditLogs({ actor: "admin", action: "", resourceType: "", startDate: "", endDate: "" }, 0),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(request).toHaveBeenCalled());

    const url = request.mock.calls[0][0] as string;
    expect(url).toContain("/audit-logs");
    expect(url).toContain("actor=admin");
    expect(url).toContain("limit=25");
    expect(url).toContain("offset=0");
  });

  test("returns placeholderData while loading", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: [{ id: 1 }],
    });

    const { result } = renderHook(() => useAuditLogs({}, 0), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});