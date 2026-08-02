import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

// `/merenje` -- taking a weigh-in back out.
//
// The behaviour under test is the honest bit of the undo: the row leaves the
// screen at once, but the DELETE waits out the undo window, so "Poništi" is a
// cancelled timer rather than a second write that would have to re-create a
// past day.

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { WeighInHistory } from "../weigh-in-history";

const ROWS = [
  { day: "2026-08-02", weightKg: 87.2 },
  { day: "2026-08-01", weightKg: 88.4 },
];

function renderList() {
  return render(
    <WeighInHistory
      rows={ROWS}
      todayKey="2026-08-02"
      yesterdayKey="2026-08-01"
    />
  );
}

function deleteYesterday() {
  fireEvent.click(screen.getByTestId("weigh-in-delete-2026-08-01"));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WeighInHistory", () => {
  it("test_AS_074_lists_each_reading_with_its_weight", () => {
    renderList();

    expect(screen.getAllByTestId("weigh-in-history-row")).toHaveLength(2);
    expect(screen.getByText("87,2 kg")).toBeInTheDocument();
    expect(screen.getByText("88,4 kg")).toBeInTheDocument();
  });

  it("test_AS_074_removes_the_row_at_once_but_holds_the_request", () => {
    renderList();
    deleteYesterday();

    expect(screen.getAllByTestId("weigh-in-history-row")).toHaveLength(1);
    expect(screen.getByTestId("weigh-in-undo")).toBeInTheDocument();
    // Nothing has been deleted yet -- the undo is still on offer.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("test_AS_074_undo_puts_the_reading_back_and_never_deletes_it", async () => {
    renderList();
    deleteYesterday();

    fireEvent.click(screen.getByText("Poništi"));
    expect(screen.getAllByTestId("weigh-in-history-row")).toHaveLength(2);

    // The window passing must not resurrect the cancelled delete.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("test_AS_074_deletes_once_the_undo_window_closes", async () => {
    renderList();
    deleteYesterday();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/merenje");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({ day: "2026-08-01" });
    // The banner on `/danas` and the verdict card both derive from this row's
    // absence, so the server has to be asked again.
    expect(refreshMock).toHaveBeenCalled();
  });

  it("test_AS_074_puts_the_row_back_when_the_delete_fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    renderList();
    deleteYesterday();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByTestId("weigh-in-history-row")).toHaveLength(2);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
