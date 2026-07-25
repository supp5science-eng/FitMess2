import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// `/profil/telefon` -- editing a number that already exists. The bug this
// replaces: Podešavanja linked at the onboarding capture gate `/telefon`, which
// greeted a user who signed up WITH a phone as if they had never given one, and
// offered no way back into the app.

const maybeSingleMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: maybeSingleMock }),
        }),
      }),
    }),
}));

const getCurrentUserIdMock = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  getCurrentUserId: () => getCurrentUserIdMock(),
}));

const changePhoneActionMock = vi.fn();
vi.mock("../actions", () => ({
  changePhoneAction: (...args: unknown[]) => changePhoneActionMock(...args),
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

import TelefonSettingsPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserIdMock.mockResolvedValue("user-1");
  maybeSingleMock.mockResolvedValue({ data: { phone: "+381600637486" } });
  changePhoneActionMock.mockResolvedValue({ ok: true, phone: "+381600637486" });
});

describe("Broj telefona u Podešavanjima", () => {
  it("test_prefills_the_number_already_on_the_profile", async () => {
    render(await TelefonSettingsPage());

    expect(screen.getByLabelText("Broj telefona")).toHaveValue("600637486");
    expect(screen.getByLabelText("Pozivni broj države")).toHaveValue("+381");
  });

  it("test_there_is_always_a_way_back_to_podesavanja", async () => {
    render(await TelefonSettingsPage());

    expect(screen.getByRole("link", { name: /Podešavanja/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });

  it("test_saving_is_disabled_until_the_number_actually_changes", async () => {
    render(await TelefonSettingsPage());

    const save = screen.getByRole("button", { name: "Sačuvaj broj" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Broj telefona"), {
      target: { value: "601112223" },
    });
    expect(save).toBeEnabled();
  });

  it("test_a_saved_number_confirms_and_returns_to_the_settings_list", async () => {
    render(await TelefonSettingsPage());

    fireEvent.change(screen.getByLabelText("Broj telefona"), {
      target: { value: "601112223" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj broj" }));

    await screen.findByText("Broj telefona je sačuvan.");
    expect(changePhoneActionMock).toHaveBeenCalledWith({
      dialCode: "+381",
      local: "601112223",
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("test_a_rejected_number_explains_itself_and_stays_on_the_page", async () => {
    changePhoneActionMock.mockResolvedValue({
      ok: false,
      error_sr: "Unesi ispravan broj telefona.",
    });

    render(await TelefonSettingsPage());
    fireEvent.change(screen.getByLabelText("Broj telefona"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sačuvaj broj" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unesi ispravan broj telefona."
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("test_a_profile_without_a_number_offers_to_add_one", async () => {
    maybeSingleMock.mockResolvedValue({ data: { phone: null } });

    render(await TelefonSettingsPage());

    expect(screen.getByLabelText("Broj telefona")).toHaveValue("");
    expect(screen.getByText(/Još nemamo tvoj broj/)).toBeInTheDocument();
  });
});
