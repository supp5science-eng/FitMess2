import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AppSplash } from "@/components/shell/app-splash";

// The launch splash covers the blank first paint on a PWA cold launch with a
// branded animation, then dismisses itself. These lock the brand content and
// the once-per-session replay guard.
describe("AppSplash: premium launch splash", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => cleanup());

  it("test_renders_the_fitmess_wordmark_with_the_accented_mess_and_the_pear_mark", () => {
    render(<AppSplash />);

    const status = screen.getByRole("status", { name: "FitMess se učitava" });
    expect(status).toHaveTextContent("FitMess");

    // "Mess" carries the brand accent (the iridescent wordmark gradient).
    const accent = status.querySelector(".fm-wordmark-accent");
    expect(accent).not.toBeNull();
    expect(accent).toHaveTextContent("Mess");

    // The pear mark is present at launch size.
    const mark = status.querySelector("img.fm-splash__mark");
    expect(mark).toHaveAttribute("src", "/brand/fitmess-icon.png");
  });

  it("test_plays_once_then_is_suppressed_on_a_later_in_app_remount", () => {
    const first = render(<AppSplash />);
    expect(first.container.querySelector(".fm-splash")).not.toBeNull();
    first.unmount();

    // A soft in-app navigation that remounts the shell in the same session
    // must not replay the splash.
    const second = render(<AppSplash />);
    expect(second.container.firstChild).toBeNull();
  });
});
