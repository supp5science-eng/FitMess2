import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn(() => "/danas");
const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  // `PushTapListener` (store app only) asks for the router so a tapped
  // reminder can navigate. It is inert in a browser, but the hook still runs.
  useRouter: () => ({ push: routerPushMock }),
}));

// `AccountsSync` (mounted by the shell) builds a real browser Supabase client
// on mount, which throws without `NEXT_PUBLIC_SUPABASE_URL` / the publishable
// key in the environment. Nothing here is about the account registry, so the
// client is stubbed the way the auth component tests do it and the layout
// assertions below stay credential-free.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  }),
}));

import { AppShell } from "./app-shell";

describe("AppShell (F005 base shell)", () => {
  it("test_AS_125_app_shell_column_is_capped_at_mobile_width_and_hides_horizontal_overflow", () => {
    // AS-125: renders correctly at the 375px baseline with no horizontal
    // scroll. The inner column is capped at 430px (comfortably above the
    // 375px baseline) and forces overflow-x hidden so a stray wide child
    // can never introduce a horizontal scrollbar. `:not(.fm-splash)` skips the
    // launch splash, the other direct grandchild of the container, which is
    // still rendered on the first shell render of this file.
    const { container } = render(
      <AppShell>
        <p>sadrzaj</p>
      </AppShell>
    );
    const column = container.querySelector(":scope > div > div:not(.fm-splash)");
    expect(column).not.toBeNull();
    expect(column?.className).toMatch(/max-w-\[430px\]/);
    expect(column?.className).toMatch(/overflow-x-hidden/);
    expect(column?.className).toMatch(/w-full/);
  });

  it("test_AS_126_app_shell_outer_wrapper_spans_full_width_and_centers_the_inner_column", () => {
    // AS-126: on desktop the app appears as a centered mobile-width column
    // on a light background. The outer wrapper is full-width with a light
    // (muted) background; the inner column is horizontally centered via
    // `mx-auto` and keeps the mobile max-width regardless of viewport.
    const { container } = render(
      <AppShell>
        <p>sadrzaj</p>
      </AppShell>
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toMatch(/w-full/);
    expect(outer?.className).toMatch(/bg-muted/);

    const column = container.querySelector(":scope > div > div:not(.fm-splash)");
    expect(column?.className).toMatch(/mx-auto/);
  });

  it("test_AS_127_app_shell_column_uses_the_light_background_token", () => {
    // AS-127: light theme only, `bg-background` resolves to the near-white
    // `--background` token defined in globals.css (no dark-mode class is
    // ever applied by the shell).
    const { container } = render(
      <AppShell>
        <p>sadrzaj</p>
      </AppShell>
    );
    const column = container.querySelector(":scope > div > div:not(.fm-splash)");
    expect(column?.className).toMatch(/bg-background/);
    expect(container.querySelector(".dark")).toBeNull();
  });

  it("renders the bottom navigation alongside its children", () => {
    usePathnameMock.mockReturnValue("/danas");
    render(
      <AppShell>
        <p>naslovna sadrzaj</p>
      </AppShell>
    );
    expect(screen.getByText("naslovna sadrzaj")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Glavna navigacija" })
    ).toBeInTheDocument();
  });

  it.each([
    ["/prijava"],
    ["/registracija"],
    ["/registracija/proveri-email"],
    ["/telefon"],
  ])(
    "renders auth route %s full-bleed: no app column, no bottom nav",
    (pathname) => {
      // Auth screens own the whole viewport with their own dark chrome
      // (src/app/(auth)/layout.tsx) and must not expose the app navigation
      // (its tabs link into the authenticated app), so the shell drops both
      // the centered white column and the bottom nav.
      usePathnameMock.mockReturnValue(pathname);
      const { container } = render(
        <AppShell>
          <p>auth sadrzaj</p>
        </AppShell>
      );
      expect(screen.getByText("auth sadrzaj")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "Glavna navigacija" })
      ).toBeNull();
      expect(container.querySelector(".max-w-\\[430px\\]")).toBeNull();
    }
  );

  it.each([["/onboarding"], ["/onboarding/pregled"]])(
    "renders onboarding route %s full-bleed: no app column, no bottom nav",
    (pathname) => {
      // The post-login welcome + questionnaire own the whole viewport and must
      // not expose the app navigation: the Danas/Nedelja/Agent/Profil tabs only
      // become available once onboarding is finished.
      usePathnameMock.mockReturnValue(pathname);
      const { container } = render(
        <AppShell>
          <p>onboarding sadrzaj</p>
        </AppShell>
      );
      expect(screen.getByText("onboarding sadrzaj")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "Glavna navigacija" })
      ).toBeNull();
      expect(container.querySelector(".max-w-\\[430px\\]")).toBeNull();
    }
  );

  it.each([["/ai"], ["/ai/podesavanja"]])(
    "renders Prizma route %s chromeless: keeps the app column, drops the bottom nav",
    (pathname) => {
      // Prizma owns the screen, so the four tabs (and the "+" trigger) step
      // aside — but unlike the full-bleed routes above she still lives inside
      // the shell: the centered mobile column, the background and the scroll
      // region all stay. That difference is the whole point of the third mode.
      usePathnameMock.mockReturnValue(pathname);
      const { container } = render(
        <AppShell>
          <p>prizma sadrzaj</p>
        </AppShell>
      );
      expect(screen.getByText("prizma sadrzaj")).toBeInTheDocument();
      expect(
        screen.queryByRole("navigation", { name: "Glavna navigacija" })
      ).toBeNull();
      const column = container.querySelector(".max-w-\\[430px\\]");
      expect(column).not.toBeNull();
      expect(column?.className).toMatch(/bg-background/);
    }
  );

  it("pads the chromeless column clear of the home indicator", () => {
    // The bottom nav carried `env(safe-area-inset-bottom)` for everyone
    // (see `app-nav-bar.tsx`); with it gone the column has to carry it, or the
    // last of the content sits under the iPhone home indicator.
    usePathnameMock.mockReturnValue("/ai");
    const { container } = render(
      <AppShell>
        <p>prizma sadrzaj</p>
      </AppShell>
    );
    const column = container.querySelector(".max-w-\\[430px\\]");
    expect(column?.className).toMatch(/pb-\[env\(safe-area-inset-bottom\)\]/);
  });

  it("leaves the home-indicator inset to the nav on ordinary routes", () => {
    // Guards the other half: `AppNavBar` still owns the inset on full-shell
    // routes, so the column must not add a second copy of it.
    usePathnameMock.mockReturnValue("/danas");
    const { container } = render(
      <AppShell>
        <p>naslovna sadrzaj</p>
      </AppShell>
    );
    const column = container.querySelector(".max-w-\\[430px\\]");
    expect(column?.className).not.toMatch(
      /pb-\[env\(safe-area-inset-bottom\)\]/
    );
  });

  it("renders the marketing landing (/) full-bleed: no app column, no bottom nav", () => {
    // The public landing page supplies its own full-width chrome, so the
    // shell must not wrap it in the centered mobile column or the bottom
    // navigation (which links to authenticated app sections).
    usePathnameMock.mockReturnValue("/");
    const { container } = render(
      <AppShell>
        <p>landing sadrzaj</p>
      </AppShell>
    );
    expect(screen.getByText("landing sadrzaj")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Glavna navigacija" })
    ).toBeNull();
    expect(container.querySelector(".max-w-\\[430px\\]")).toBeNull();
  });
});
