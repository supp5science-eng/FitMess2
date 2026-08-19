import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Google sign-in INSIDE the native shell. The web flow is covered by
// `google-oauth.test.tsx`; this file covers the part that exists because the
// web flow does not survive an embedded web view — the platform account picker
// and the ID token it hands to Supabase (`@/lib/auth/google-native`).
//
// The first test is the one that matters most today: with the console setup
// unfinished, the shell must render NO Google button at all. A button that
// fails at the tap is what this whole feature is here to stop shipping.

const loginMock = vi.fn();
const initializeMock = vi.fn();
vi.mock("@capgo/capacitor-social-login", () => ({
  SocialLogin: {
    initialize: (...args: unknown[]) => initializeMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
  },
}));

const signInWithIdTokenMock = vi.fn();
const signInWithOAuthMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: signInWithIdTokenMock,
      signInWithOAuth: signInWithOAuthMock,
    },
  }),
}));

import { SR_AUTH_MESSAGES } from "@/lib/auth/errors";

import { SocialSignIn } from "../social-sign-in";

/** `SocialSignIn` takes `t` for its own "ili" divider; the buttons inside it
 * resolve their labels through `useT()`, so they render real Serbian copy and
 * are queried here by accessible name rather than by key. */
const t = ((key: string) => key) as never;

const assignMock = vi.fn();

beforeEach(() => {
  initializeMock.mockReset().mockResolvedValue(undefined);
  loginMock.mockReset();
  signInWithIdTokenMock.mockReset().mockResolvedValue({ error: null });
  signInWithOAuthMock.mockReset();
  assignMock.mockReset();
  Object.defineProperty(window, "location", {
    value: { assign: assignMock, origin: "https://fitmess.app" },
    writable: true,
  });
});

/** The same hash Supabase computes, so the test checks the pairing rather than
 * trusting the implementation to agree with itself. */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

describe("Google in the native shell", () => {
  it("offers no Google button while the native path is not configured", () => {
    render(<SocialSignIn t={t} isNativeShell nativeGoogle={false} />);

    expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
    // Apple is never gated — it is the guideline 4.8 requirement.
    expect(screen.getByRole("button", { name: /apple/i })).toBeTruthy();
  });

  it("signs in through the platform account picker, not a web redirect", async () => {
    loginMock.mockResolvedValue({
      provider: "google",
      result: { idToken: "id-token-123" },
    });

    render(<SocialSignIn t={t} isNativeShell nativeGoogle />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(signInWithIdTokenMock).toHaveBeenCalled());

    // The nonce is the part the first device test broke on: Google's SDK mints
    // one whether or not we do, so ours has to be the one in the token. Google
    // is handed the HASH and Supabase the raw value — same nonce, and only the
    // raw side can prove it.
    const sentToGoogle = loginMock.mock.calls[0][0].options.nonce as string;
    const sentToSupabase = signInWithIdTokenMock.mock.calls[0][0];
    expect(sentToSupabase.provider).toBe("google");
    expect(sentToSupabase.token).toBe("id-token-123");
    expect(sentToGoogle).toMatch(/^[0-9a-f]{64}$/);
    expect(sentToSupabase.nonce).not.toBe(sentToGoogle);
    expect(await sha256Hex(sentToSupabase.nonce as string)).toBe(sentToGoogle);
    // The web view must never be sent to Google from inside the shell — that
    // is the flow Google degrades, and the reason this path exists.
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    // A FULL load, so the middleware re-runs against the new session cookies.
    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/danas"));
  });

  it("shows the one Serbian message when the sheet is closed or Google refuses", async () => {
    loginMock.mockRejectedValue(new Error("USER_CANCELLED"));

    render(<SocialSignIn t={t} isNativeShell nativeGoogle />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(SR_AUTH_MESSAGES.generic)
    );
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("treats a login with no ID token as a failure rather than a signed-in user", async () => {
    loginMock.mockResolvedValue({ provider: "google", result: {} });

    render(<SocialSignIn t={t} isNativeShell nativeGoogle />);
    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(signInWithIdTokenMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });
});
