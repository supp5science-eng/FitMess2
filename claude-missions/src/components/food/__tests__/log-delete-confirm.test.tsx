import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F026 / AS-045: component-level coverage of the reusable delete-confirm's
// open/confirm/cancel flow. The live DB delete is covered separately by
// `src/app/api/logs/[id]/__tests__/route.integration.test.ts`.

vi.stubGlobal("fetch", vi.fn());

import { LogDeleteConfirm } from "@/components/food/log-delete-confirm";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  (global.fetch as ReturnType<typeof vi.fn>).mockReset();
});

describe("F026 / AS-045: LogDeleteConfirm is a Serbian confirm gate", () => {
  it("test_AS_045_the_confirm_is_closed_by_default_only_the_obrisi_trigger_is_visible", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Jabuka" />);

    expect(screen.getByTestId("log-delete-open-button")).toBeInTheDocument();
    expect(screen.queryByTestId("log-delete-confirm")).not.toBeInTheDocument();
  });

  it("test_AS_045_clicking_obrisi_opens_a_serbian_confirm_naming_the_entry", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Ovsena kaša" />);

    fireEvent.click(screen.getByTestId("log-delete-open-button"));

    const confirm = screen.getByTestId("log-delete-confirm");
    expect(confirm).toBeInTheDocument();
    expect(confirm).toHaveTextContent("Ovsena kaša");
    expect(confirm).toHaveTextContent(/obrisati/i);
  });

  it("test_AS_045_canceling_closes_the_confirm_without_calling_the_delete_endpoint", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Jabuka" />);
    fireEvent.click(screen.getByTestId("log-delete-open-button"));
    fireEvent.click(screen.getByTestId("log-delete-cancel-button"));

    expect(screen.queryByTestId("log-delete-confirm")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("test_AS_045_confirming_DELETEs_the_correct_log_id_and_calls_onDeleted_on_success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse({ ok: true, data: null })
    );
    const onDeleted = vi.fn();

    render(
      <LogDeleteConfirm logId="log-77" logName="Jabuka" onDeleted={onDeleted} />
    );
    fireEvent.click(screen.getByTestId("log-delete-open-button"));
    fireEvent.click(screen.getByTestId("log-delete-confirm-button"));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("log-77"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/logs/log-77",
      expect.objectContaining({ method: "DELETE" })
    );
    // Confirm closes on success.
    await waitFor(() =>
      expect(screen.queryByTestId("log-delete-confirm")).not.toBeInTheDocument()
    );
  });

  it("test_AS_045_a_failed_delete_shows_an_inline_serbian_error_and_does_not_call_onDeleted", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(
        { ok: false, error_sr: "Nismo uspeli da obrišemo unos. Pokušaj ponovo." },
        false
      )
    );
    const onDeleted = vi.fn();

    render(
      <LogDeleteConfirm logId="log-1" logName="Jabuka" onDeleted={onDeleted} />
    );
    fireEvent.click(screen.getByTestId("log-delete-open-button"));
    fireEvent.click(screen.getByTestId("log-delete-confirm-button"));

    await waitFor(() =>
      expect(screen.getByTestId("log-delete-error")).toHaveTextContent(
        "Nismo uspeli da obrišemo unos. Pokušaj ponovo."
      )
    );
    expect(onDeleted).not.toHaveBeenCalled();
    // Retry affordance: the confirm stays open.
    expect(screen.getByTestId("log-delete-confirm")).toBeInTheDocument();
  });
});
