/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type AxiosResponse } from "axios";
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
    deleteMock.mockResolvedValue({ data: {} } as unknown as AxiosResponse);
  });

  test("search input triggers debounced query", async () => {
    getMock.mockResolvedValue({
      data: { data: [], meta: { totalItems: 0 } },
    } as unknown as AxiosResponse);

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
    } as unknown as AxiosResponse);

    setup();

    const checkboxes = await screen.findAllByRole("checkbox", {}, { timeout: 5000 });

    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    const bulkDelete = await screen.findByText(/löschen/i);
    fireEvent.click(bulkDelete);

    const confirm = await screen.queryByRole("button", { name: /bestätigen|confirm|ja/i });
    if (confirm) fireEvent.click(confirm);

    await waitFor(
      () => {
        expect(deleteMock).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    expect(deleteMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});