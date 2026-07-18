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

describe("AS-128: LogDeleteConfirm's interactive elements are labeled/keyboard-reachable", () => {
  it("test_AS_128_the_open_cancel_and_confirm_controls_are_real_keyboard_reachable_button_elements_findable_by_role_and_name", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Jabuka" />);

    // `getByRole("button", {name})` only succeeds for a real, accessibly
    // named <button> -- confirms both "is a native button" (keyboard Tab +
    // Enter/Space reachable by default) and "has an accessible name" at
    // once.
    const openButton = screen.getByRole("button", { name: "Obriši" });
    expect(openButton).toBe(screen.getByTestId("log-delete-open-button"));
    expect(openButton.tagName).toBe("BUTTON");
    expect(openButton).not.toHaveAttribute("tabindex", "-1");

    fireEvent.click(openButton);

    const cancelButton = screen.getByRole("button", { name: "Otkaži" });
    expect(cancelButton).toBe(screen.getByTestId("log-delete-cancel-button"));
    expect(cancelButton.tagName).toBe("BUTTON");

    const confirmButton = screen.getByTestId("log-delete-confirm-button");
    expect(confirmButton.tagName).toBe("BUTTON");
    expect(confirmButton).not.toHaveAttribute("tabindex", "-1");
  });

  it("test_AS_128_the_confirm_dialog_is_labeled_by_its_own_heading_for_assistive_tech", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Jabuka" />);
    fireEvent.click(screen.getByTestId("log-delete-open-button"));

    const dialog = screen.getByRole("alertdialog");
    const heading = screen.getByRole("heading", {
      name: "Obrisati unos “Jabuka”?",
    });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("test_AS_128_the_confirm_renders_no_bare_images_without_alt_text", () => {
    render(<LogDeleteConfirm logId="log-1" logName="Jabuka" />);
    fireEvent.click(screen.getByTestId("log-delete-open-button"));

    // This confirm renders no <img> elements at all (everything is text) --
    // so there is nothing that could be missing alt text. Asserted
    // explicitly rather than assumed.
    const images = screen
      .getByTestId("log-delete-confirm")
      .querySelectorAll("img");
    expect(images.length).toBe(0);
  });
});
