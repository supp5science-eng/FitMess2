import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/danas"),
}));

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";

describe("BottomNav (redesign 2026-08-25: two tabs)", () => {
  it("renders exactly two tabs: AI and Profil", () => {
    render(<BottomNav />);
    expect(
      screen.getByRole("navigation", { name: "Glavna navigacija" })
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: /AI/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Profil/ })).toBeInTheDocument();
  });

  it("links point to the expected routes", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /AI/ })).toHaveAttribute(
      "href",
      "/danas"
    );
    expect(screen.getByRole("link", { name: /Profil/ })).toHaveAttribute(
      "href",
      "/profil"
    );
  });

  it("marks the active tab with the accent color and aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/danas");
    render(<BottomNav />);
    const activeLink = screen.getByRole("link", { name: /AI/ });
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(activeLink.className).toMatch(/text-primary/);

    const inactiveLink = screen.getByRole("link", { name: /Profil/ });
    expect(inactiveLink).not.toHaveAttribute("aria-current");
    expect(inactiveLink.className).not.toMatch(/text-primary\b/);
  });

  it("every nav item is a real anchor element, so it is reachable and activatable via keyboard alone", () => {
    render(<BottomNav />);
    for (const name of [/AI/, /Profil/]) {
      const link = screen.getByRole("link", { name });
      expect(link.tagName).toBe("A");
      expect(link).not.toHaveAttribute("tabindex", "-1");
    }
  });
});
