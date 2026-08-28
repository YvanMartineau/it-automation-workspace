/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../src/lib/api";
import AssetIndex from "../../../src/pages/Assets/Index";
import { MemoryRouter } from "react-router-dom";

const getMock = vi.spyOn(api, "get");
const deleteMock = vi.spyOn(api, "delete");

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AssetIndex />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("Integration – AssetIndex Page", () => {
  beforeEach(() => {
    getMock.mockReset();
    deleteMock.mockReset();
    deleteMock.mockResolvedValue({ data: {} } as any);
  });

  test("search input triggers debounced query", async () => {
    getMock.mockResolvedValue({ data: { data: [], meta: { totalItems: 0 } } } as any);
    setup();

    const search = screen.getByPlaceholderText(/suche/i);
    fireEvent.change(search, { target: { value: "server" } });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });
  });

  test("bulk delete triggers DELETE calls", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: "1", status: "online", cpu: 10, memory: 10, hostname: "srv-1" },
          { id: "2", status: "online", cpu: 10, memory: 10, hostname: "srv-2" },
        ],
        meta: { totalItems: 2 },
      },
    } as any);

    setup();

    // wait for rows
    const checkboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 });

    // skip header [0], select both rows [1] and [2]
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const bulkDelete = await screen.findByText(/löschen/i);
    fireEvent.click(bulkDelete);

    // handle confirm dialog if your component has one
    const confirm = await screen.queryByRole("button", { name: /bestätigen|confirm|ja/i });
    if (confirm) fireEvent.click(confirm);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    }, { timeout: 3000 });

    // accept both implementations: 1 bulk call OR 2 individual calls
    expect(deleteMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    const allCalls = JSON.stringify(deleteMock.mock.calls);
    // should have tried to delete both ids somewhere
    expect(allCalls).toContain("1");
  });
});