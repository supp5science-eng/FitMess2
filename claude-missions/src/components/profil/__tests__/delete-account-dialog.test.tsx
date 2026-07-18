import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F019: component-level coverage for the type-to-confirm account-deletion
// dialog on `/profil` (AS-015, AS-016). The live DB + auth round-trip is
// covered separately by
// `src/app/api/account/delete/__tests__/route.integration.test.ts`.

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import { DeleteAccountDialog } from "../delete-account-dialog";
import { DELETE_CONFIRMATION_PHRASE } from "@/lib/account/constants";

beforeEach(() => {
  pushMock.mockClear();
  refreshMock.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

describe("AS-015/AS-016: the delete-account dialog is a type-to-confirm gate", () => {
  it("test_AS_015_the_dialog_is_closed_by_default_only_the_open_button_is_visible", () => {
    render(<DeleteAccountDialog />);

    expect(screen.getByTestId("delete-account-open-button")).toBeInTheDocument();
    expect(screen.queryByTestId("delete-account-dialog")).not.toBeInTheDocument();
  });

  it("test_AS_015_clicking_obrisi_nalog_opens_a_serbian_irreversibility_warning_dialog", () => {
    render(<DeleteAccountDialog />);

    fireEvent.click(screen.getByTestId("delete-account-open-button"));

    const dialog = screen.getByTestId("delete-account-dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/trajna/i);
    expect(dialog).toHaveTextContent(/ne mo(ž|z)e se poni(š|s)titi/i);
  });

  it("test_AS_015_the_confirm_button_is_disabled_until_the_exact_phrase_is_typed", () => {
    render(<DeleteAccountDialog />);
    fireEvent.click(screen.getByTestId("delete-account-open-button"));

    const confirmButton = screen.getByTestId("delete-account-confirm-button");
    const input = screen.getByTestId("delete-account-confirm-input");

    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "obrisi" } });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(input, { target: { value: DELETE_CONFIRMATION_PHRASE } });
    expect(confirmButton).not.toBeDisabled();
  });

  it("test_AS_015_canceling_closes_the_dialog_without_calling_the_delete_endpoint", () => {
    render(<DeleteAccountDialog />);
    fireEvent.click(screen.getByTestId("delete-account-open-button"));
    fireEvent.click(screen.getByTestId("delete-account-cancel-button"));

    expect(screen.queryByTestId("delete-account-dialog")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("test_AS_015_submitting_the_correct_phrase_posts_to_the_delete_route_and_redirects_to_prijava_on_success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: null }),
    });

    render(<DeleteAccountDialog />);
    fireEvent.click(screen.getByTestId("delete-account-open-button"));
    fireEvent.change(screen.getByTestId("delete-account-confirm-input"), {
      target: { value: DELETE_CONFIRMATION_PHRASE },
    });
    fireEvent.click(screen.getByTestId("delete-account-confirm-button"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/prijava"));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/account/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirm: DELETE_CONFIRMATION_PHRASE }),
      })
    );
  });

  it("test_AS_015_a_failed_deletion_shows_an_inline_serbian_error_and_does_not_redirect", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error_sr: "Nije uspelo brisanje naloga." }),
    });

    render(<DeleteAccountDialog />);
    fireEvent.click(screen.getByTestId("delete-account-open-button"));
    fireEvent.change(screen.getByTestId("delete-account-confirm-input"), {
      target: { value: DELETE_CONFIRMATION_PHRASE },
    });
    fireEvent.click(screen.getByTestId("delete-account-confirm-button"));

    await waitFor(() =>
      expect(screen.getByTestId("delete-account-error")).toHaveTextContent(
        "Nije uspelo brisanje naloga."
      )
    );
    expect(pushMock).not.toHaveBeenCalled();
    // Dialog stays open so the user can retry.
    expect(screen.getByTestId("delete-account-dialog")).toBeInTheDocument();
  });
});
