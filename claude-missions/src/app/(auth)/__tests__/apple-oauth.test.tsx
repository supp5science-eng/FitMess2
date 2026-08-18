import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Sign in with Apple — the fix for the **guideline 4.8** rejection of
 * 17.08.2026 (submission 4f3c776d-297d-4899-a184-265ccf27be15).
 *
 * What these tests actually protect, beyond "the call is made with the right
 * provider": that the compliant login option is present on BOTH auth screens,
 * as an equivalent option. 4.8 is not satisfied by a button that exists
 * somewhere — the guideline's word is *equivalent*, and a future refactor that
 * quietly drops Apple from one of the two screens re-opens the rejection
 * without breaking anything a normal test would notice.
 *
 * The interactive Apple consent screen itself is not automatable here; see
 * `docs/prijava-sa-apple.md` for the manual verification that covers the rest
 * of the round trip (Hide My Email, the native shell, the relay address).
 */

const signInWithOAuthMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}));

import { AppleSignInButton } from "../apple-sign-in-button";
import PrijavaPage from "../prijava/page";
import RegistracijaPage from "../registracija/page";

const APPLE_LABEL = /Nastavi sa Apple nalogom/i;
const GOOGLE_LABEL = /Nastavi sa Google/i;

describe("guideline 4.8: Sign in with Apple is offered as an equivalent option", () => {
  beforeEach(() => {
    signInWithOAuthMock.mockReset();
    signInWithOAuthMock.mockResolvedValue({
      data: { provider: "apple", url: "https://appleid.apple.com/auth/authorize?..." },
      error: null,
    });
  });

  it("test_4_8_apple_button_renders_on_the_prijava_page", async () => {
    const ui = await PrijavaPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByRole("button", { name: APPLE_LABEL })).toBeInTheDocument();
  });

  it("test_4_8_apple_button_renders_on_the_registracija_page", async () => {
    const ui = await RegistracijaPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(screen.getByRole("button", { name: APPLE_LABEL })).toBeInTheDocument();
  });

  it("test_4_8_both_auth_screens_offer_apple_alongside_google", async () => {
    // The equivalence requirement, stated as a test: wherever the third-party
    // login service is offered, the compliant one is offered too.
    const prijava = await PrijavaPage({ searchParams: Promise.resolve({}) });
    const { unmount } = render(prijava);
    expect(screen.getByRole("button", { name: GOOGLE_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: APPLE_LABEL })).toBeInTheDocument();
    unmount();

    const registracija = await RegistracijaPage({
      searchParams: Promise.resolve({}),
    });
    render(registracija);
    expect(screen.getByRole("button", { name: GOOGLE_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: APPLE_LABEL })).toBeInTheDocument();
  });

  it("test_4_8_clicking_apple_invokes_signInWithOAuth_with_the_apple_provider_and_the_auth_callback_redirect", async () => {
    render(<AppleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: APPLE_LABEL }));

    await waitFor(() => expect(signInWithOAuthMock).toHaveBeenCalledTimes(1));
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it("test_4_8_apple_authorize_url_carries_no_google_only_query_params", async () => {
    // `prompt=select_account` is a Google parameter. Apple answers an unknown
    // parameter with `invalid_request` rather than ignoring it, so copying the
    // Google button wholesale would produce a button that always errors.
    render(<AppleSignInButton />);
    fireEvent.click(screen.getByRole("button", { name: APPLE_LABEL }));

    await waitFor(() => expect(signInWithOAuthMock).toHaveBeenCalledTimes(1));
    const call = signInWithOAuthMock.mock.calls[0][0];
    expect(call.options).not.toHaveProperty("queryParams");
  });

  it("test_4_8_apple_button_shows_a_serbian_error_and_stays_usable_if_the_oauth_request_cannot_be_started", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { provider: "apple", url: null },
      error: { message: "Unsupported provider: provider is not enabled" },
    });

    render(<AppleSignInButton />);
    fireEvent.click(screen.getByRole("button", { name: APPLE_LABEL }));

    const alert = await screen.findByRole("alert");
    // Never the raw Supabase error text -- the same never-technical Serbian
    // convention F011 established. This is also the exact failure mode of a
    // deploy that ships the button before the Supabase provider is switched
    // on, so it must degrade to calm copy rather than English internals.
    expect(alert.textContent).not.toMatch(/Unsupported provider/i);
    expect(alert.textContent?.length).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: APPLE_LABEL })).not.toBeDisabled();
  });
});
