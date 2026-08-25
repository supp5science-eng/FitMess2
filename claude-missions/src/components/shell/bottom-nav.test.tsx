import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/danas"),
}));

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";

describe("BottomNav (F005 base shell)", () => {
  it("test_AS_002_bottom_nav_renders_three_serbian_tab_labels", () => {
    // AS-002: all copy on the shell, including the nav, is Serbian sr-Latn.
    render(<BottomNav />);
    expect(
      screen.getByRole("navigation", { name: "Glavna navigacija" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Početna/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Analitika/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profil/ })).toBeInTheDocument();
  });

  it("test_AS_002_bottom_nav_links_point_to_the_expected_serbian_routes", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /Početna/ })).toHaveAttribute(
      "href",
      "/danas"
    );
    expect(screen.getByRole("link", { name: /Analitika/ })).toHaveAttribute(
      "href",
      "/analitika"
    );
    expect(screen.getByRole("link", { name: /Profil/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });

  it("test_AS_127_bottom_nav_marks_the_active_tab_with_the_single_accent_color_and_aria_current", () => {
    // AS-127: the shell has one consistent accent; the active tab uses the
    // `text-primary` utility, which resolves to the single green accent
    // token defined in globals.css.
    vi.mocked(usePathname).mockReturnValue("/danas");
    render(<BottomNav />);
    const activeLink = screen.getByRole("link", { name: /Početna/ });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink.className).toMatch(/text-primary/);

    const inactiveLink = screen.getByRole("link", { name: /Analitika/ });
    expect(inactiveLink).not.toHaveAttribute("aria-current");
    expect(inactiveLink.className).not.toMatch(/text-primary\b/);
  });

  it("every nav item is a real anchor element, so it is reachable and activatable via keyboard alone", () => {
    render(<BottomNav />);
    for (const name of [/Početna/, /Analitika/, /Profil/]) {
      const link = screen.getByRole("link", { name });
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("tabindex", "-1");
    }
  });
});
