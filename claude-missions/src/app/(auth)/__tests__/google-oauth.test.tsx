import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F012 / AS-010: component-level coverage for the part of "a user can sign
// in with Google" that IS automatable without a real interactive Google
// consent screen -- the button renders on both auth pages and invokes
// `supabase.auth.signInWithOAuth` with `provider: "google"` and the correct
// `redirectTo`. See `src/app/(auth)/__tests__/google-oauth.integration.test.ts`
// for the live-project coverage (provider enabled, confirmation gate,
// profiles trigger) and the F012 handoff for what remains verifiable only by
// a human at manual QA.

const signInWithOAuthMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}));

import { GoogleSignInButton } from "../google-sign-in-button";
import PrijavaPage from "../prijava/page";
import RegistracijaPage from "../registracija/page";

describe("AS-010: a user can sign in with Google OAuth", () => {
  beforeEach(() => {
    signInWithOAuthMock.mockReset();
    signInWithOAuthMock.mockResolvedValue({
      data: { provider: "google", url: "https://accounts.google.com/o/oauth2/auth?..." },
      error: null,
    });
  });

  it("test_AS_010_google_button_renders_on_the_prijava_page", async () => {
    // PrijavaPage is an async Server Component; calling it directly and
    // awaiting its returned element (rather than passing the function
    // itself to `render`) is the standard way to exercise an async RSC
    // under Vitest/RTL without a full Next.js server.
    const ui = await PrijavaPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(
      screen.getByRole("button", { name: /Nastavi sa Google/i })
    ).toBeInTheDocument();
  });

  it("test_AS_010_google_button_renders_on_the_registracija_page", async () => {
    // Same async-RSC pattern as the prijava case above: call it and await the
    // element it returns. Rendering `<RegistracijaPage />` directly typechecks
    // only by accident -- the component requires `searchParams`.
    const ui = await RegistracijaPage({ searchParams: Promise.resolve({}) });
    render(ui);

    expect(
      screen.getByRole("button", { name: /Nastavi sa Google/i })
    ).toBeInTheDocument();
  });

  it("test_AS_010_clicking_the_google_button_invokes_signInWithOAuth_with_the_google_provider_and_the_auth_callback_redirect", async () => {
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /Nastavi sa Google/i }));

    await waitFor(() =>
      expect(signInWithOAuthMock).toHaveBeenCalledTimes(1)
    );
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  });

  it("test_AS_010_google_button_shows_a_serbian_error_and_stays_usable_if_the_oauth_request_cannot_be_started", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({
      data: { provider: "google", url: null },
      error: { message: "provider misconfigured" },
    });

    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button", { name: /Nastavi sa Google/i }));

    const alert = await screen.findByRole("alert");
    // Never the raw Supabase error text -- same never-technical Serbian
    // convention F011 established.
    expect(alert.textContent).not.toMatch(/provider misconfigured/i);
    expect(alert.textContent?.length).toBeGreaterThan(0);

    const button = screen.getByRole("button", { name: /Nastavi sa Google/i });
    expect(button).not.toBeDisabled();
  });
});
