import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathnameMock = vi.fn(() => "/danas");
vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

import { AppShell } from "./app-shell";

describe("AppShell (F005 base shell)", () => {
  it("test_AS_125_app_shell_column_is_capped_at_mobile_width_and_hides_horizontal_overflow", () => {
    // AS-125: renders correctly at the 375px baseline with no horizontal
    // scroll. The inner column is capped at 430px (comfortably above the
    // 375px baseline) and forces overflow-x hidden so a stray wide child
    // can never introduce a horizontal scrollbar.
    const { container } = render(
      <AppShell>
        <p>sadrzaj</p>
      </AppShell>
    );
    const column = container.querySelector(":scope > div > div");
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

    const column = container.querySelector(":scope > div > div");
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
    const column = container.querySelector(":scope > div > div");
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
