import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// F013 / AS-012: component-level coverage that `/profil` renders a working
// "Odjavi se" (sign out) control wired to the real `signOutAction` server
// action -- the part of AS-012 that's a UI concern rather than the
// middleware's redirect behaviour (covered separately in
// `route-protection.test.ts` and `route-protection.integration.test.ts`).

const signOutActionMock = vi.fn();

vi.mock("../actions", () => ({
  signOutAction: (...args: unknown[]) => signOutActionMock(...args),
}));

// F019: `/profil` now also renders `DeleteAccountDialog`, which calls
// `useRouter()` -- mock it the same way
// `delete-account-dialog.test.tsx` does, since this file renders `ProfilPage`
// directly (no real Next App Router context mounted in a plain Vitest/jsdom
// render).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Settings redesign: `/profil` is now an async Server Component that reads the
// signed-in user's email from the session-scoped Supabase client. Mock it the
// same way `/profil/pravila`'s page test does.
const createClientMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

function mockCreateClient(user: { email?: string } | null = { email: "test@fitmess.app" }) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  };
}

import ProfilPage from "../profil/page";

describe("Settings redesign: /profil shows the signed-in account's email", () => {
  it("test_profil_page_renders_the_signed_in_users_email", async () => {
    createClientMock.mockResolvedValue(
      mockCreateClient({ email: "korisnik@fitmess.app" })
    );

    const ui = await ProfilPage();
    render(ui);

    expect(screen.getByTestId("profil-email")).toHaveTextContent(
      "korisnik@fitmess.app"
    );
  });

  it("test_profil_page_degrades_gracefully_when_no_email_is_available", async () => {
    createClientMock.mockResolvedValue(mockCreateClient(null));

    const ui = await ProfilPage();
    render(ui);

    expect(screen.queryByTestId("profil-email")).not.toBeInTheDocument();
    expect(screen.getByText(/Nismo uspeli da učitamo tvoj nalog/)).toBeInTheDocument();
  });
});

describe("AS-012: a signed-in user can sign out (UI wiring on /profil)", () => {
  it("test_AS_012_profil_page_renders_an_odjavi_se_sign_out_control", async () => {
    createClientMock.mockResolvedValue(mockCreateClient());

    const ui = await ProfilPage();
    render(ui);

    expect(
      screen.getByRole("button", { name: /Odjavi se/i })
    ).toBeInTheDocument();
  });

  it("test_AS_012_the_sign_out_button_is_inside_a_form_wired_to_the_signOutAction_server_action", async () => {
    createClientMock.mockResolvedValue(mockCreateClient());

    const ui = await ProfilPage();
    render(ui);

    const button = screen.getByRole("button", { name: /Odjavi se/i });
    const form = button.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);

    return waitFor(() => expect(signOutActionMock).toHaveBeenCalled());
  });
});
