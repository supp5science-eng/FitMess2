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

import ProfilPage from "../profil/page";

describe("AS-012: a signed-in user can sign out (UI wiring on /profil)", () => {
  it("test_AS_012_profil_page_renders_an_odjavi_se_sign_out_control", () => {
    render(<ProfilPage />);

    expect(
      screen.getByRole("button", { name: /Odjavi se/i })
    ).toBeInTheDocument();
  });

  it("test_AS_012_the_sign_out_button_is_inside_a_form_wired_to_the_signOutAction_server_action", () => {
    render(<ProfilPage />);

    const button = screen.getByRole("button", { name: /Odjavi se/i });
    const form = button.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);

    return waitFor(() => expect(signOutActionMock).toHaveBeenCalled());
  });
});
