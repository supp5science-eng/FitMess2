import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppSplash } from "@/components/shell/app-splash";

// The splash gates on a per-session flag so it plays once per cold launch, not
// on every in-app remount. Keep tests independent of each other's flag.
beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe("AppSplash: launch splash", () => {
  it("renders the brand lockup (mark + FitMess wordmark with an iridescent Mess)", () => {
    const { container } = render(<AppSplash />);

    const status = screen.getByRole("status", { name: "FitMess se učitava" });
    expect(status).toBeInTheDocument();
    expect(container.querySelector("img.fm-splash__mark")).not.toBeNull();

    // "Mess" carries the shared iridescent wordmark accent.
    const mess = container.querySelector(".fm-splash__mess");
    expect(mess).not.toBeNull();
    expect(mess).toHaveTextContent("Mess");
    expect(mess?.classList.contains("fm-wordmark-accent")).toBe(true);
  });

  it("plays once per session, then suppresses itself on later mounts", () => {
    const first = render(<AppSplash />);
    expect(first.container.querySelector(".fm-splash")).not.toBeNull();
    first.unmount();

    // Same session (the flag is now set) -> the splash stays out of the way.
    const second = render(<AppSplash />);
    expect(second.container.querySelector(".fm-splash")).toBeNull();
  });
});
