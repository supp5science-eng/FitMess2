import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F042 / AS-072, AS-073: component-level coverage of the weigh-in sheet's
// open -> validate -> POST -> refresh flow. The live DB write (upsert /
// same-day replace) is covered separately by the route integration test;
// this file proves the UI validates the range and posts the parsed number.

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.stubGlobal("fetch", vi.fn());

import { WeighInSheet } from "@/components/analytics/weigh-in-sheet";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("WeighInSheet", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    (fetch as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it("prefills the input with the last known weight", () => {
    render(<WeighInSheet lastWeightKg={82.4} />);
    fireEvent.click(screen.getByTestId("weigh-in-open-button"));
    const input = screen.getByTestId("weigh-in-input") as HTMLInputElement;
    expect(input.value).toBe("82.4");
  });

  it("rejects an out-of-range weight without posting", async () => {
    render(<WeighInSheet lastWeightKg={null} />);
    fireEvent.click(screen.getByTestId("weigh-in-open-button"));
    fireEvent.change(screen.getByTestId("weigh-in-input"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByTestId("weigh-in-save-button"));

    await waitFor(() => {
      expect(screen.getByTestId("weigh-in-error")).toBeTruthy();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts the parsed weight and refreshes on success", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: { id: "w1", day: "2026-07-15", weight_kg: 81.2 } })
    );
    render(<WeighInSheet lastWeightKg={null} />);
    fireEvent.click(screen.getByTestId("weigh-in-open-button"));
    fireEvent.change(screen.getByTestId("weigh-in-input"), {
      target: { value: "81.2" },
    });
    fireEvent.click(screen.getByTestId("weigh-in-save-button"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/weigh-ins");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      weightKg: 81.2,
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the server error message when the save fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: false, error_sr: "Nešto je puklo." }, false)
    );
    render(<WeighInSheet lastWeightKg={80} />);
    fireEvent.click(screen.getByTestId("weigh-in-open-button"));
    fireEvent.click(screen.getByTestId("weigh-in-save-button"));

    await waitFor(() => {
      expect(screen.getByTestId("weigh-in-error").textContent).toContain(
        "Nešto je puklo."
      );
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
