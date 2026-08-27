import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../../src/lib/api";
import AssetIndex from "../../../src/pages/Assets/Index";

const getMock = vi.spyOn(api, "get");
const deleteMock = vi.spyOn(api, "delete");

beforeEach(() => {
  getMock.mockReset();
  deleteMock.mockReset();
});

function setup() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AssetIndex />
    </QueryClientProvider>
  );
}

describe("Integration – AssetIndex Page", () => {
  test("search input triggers debounced query", async () => {
    getMock.mockResolvedValue({ data: { data: [], meta: { totalItems: 0 } } });

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
          { id: "1", status: "online", cpu: 10, memory: 10 },
          { id: "2", status: "online", cpu: 10, memory: 10 },
        ],
        meta: { totalItems: 2 },
      },
    });

    deleteMock.mockResolvedValue({ data: {} });

    setup();

    // select both rows
    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const bulkDelete = screen.getByText(/löschen/i);
    fireEvent.click(bulkDelete);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledTimes(2);
    });
  });
});