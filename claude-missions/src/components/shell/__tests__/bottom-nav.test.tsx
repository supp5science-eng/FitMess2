import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// F005: the bottom nav renders three tabs, marks the active one via
// aria-current from the current pathname, and mounts the sliding
// liquid-glass lens. The lens's
// exact pixel position is measured from the DOM at runtime (0 in jsdom), so
// these tests assert structure/active-state, not geometry.

const pathnameMock = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

import { BottomNav } from "@/components/shell/bottom-nav";

describe("BottomNav", () => {
  beforeEach(() => {
    pathnameMock.mockReset();
  });

  it("renders all three Serbian tabs as links", () => {
    pathnameMock.mockReturnValue("/danas");
    render(<BottomNav />);

    for (const label of ["Početna", "Analitika", "Profil"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("marks the current route's tab with aria-current=page", () => {
    pathnameMock.mockReturnValue("/analitika");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Analitika" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Početna" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("treats nested routes as active (e.g. /analitika/...)", () => {
    pathnameMock.mockReturnValue("/profil/cilj");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("mounts the sliding glass lens and hides it when no tab matches", () => {
    pathnameMock.mockReturnValue("/dodaj/pretraga");
    render(<BottomNav />);

    const lens = screen.getByTestId("nav-glass-indicator");
    expect(lens).toBeInTheDocument();
    // No nav tab owns an /dodaj route -> the lens fades out.
    expect(lens).toHaveStyle({ opacity: "0" });
    // And nothing is marked active.
    for (const label of ["Početna", "Analitika", "Profil"]) {
      expect(screen.getByRole("link", { name: label })).not.toHaveAttribute(
        "aria-current"
      );
    }
  });
});
