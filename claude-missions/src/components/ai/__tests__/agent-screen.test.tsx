import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AgentScreen } from "@/components/ai/agent-screen";

/**
 * What the `/ai` tab OPENS as, and what the composer is anchored to.
 *
 * Both were owner corrections (2026-08-26) and both are the kind of thing a
 * later refactor silently undoes — the mode is one string, and the composer's
 * offset is one CSS expression that looks interchangeable with the one next to
 * it in `use-keyboard-inset.ts`. Hence the two tests.
 */

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// `next/font` is a build-time transform; outside the Next compiler its loaders
// are plain functions that throw. The screen only ever reads `.className`.
vi.mock("next/font/local", () => ({
  default: () => ({ className: "jarvis-voice" }),
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ className: "jarvis-prose" }),
}));

// The orb is a `<canvas>`; jsdom has no 2D context and the screen's identity
// does not depend on what it paints.
vi.mock("@/components/ai/ai-orb-canvas", () => ({
  AiOrbCanvas: () => <div data-testid="ai-orb" />,
}));

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function renderScreen() {
  return render(
    <AgentScreen greeting="Dobar dan, Marko." contextLine="Do sada 0 kcal." />
  );
}

describe("AgentScreen", () => {
  it("opens on Jarvis, not on Chat", () => {
    // The screen is called Jarvis and the first segment of the top bar is
    // Jarvis; opening on Chat made the name a label over somebody else's
    // screen. Landing here asks nothing of the device — the microphone is
    // requested on the first TAP of the big button, not on arrival.
    renderScreen();

    expect(screen.getByTestId("jarvis-mode-voice")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("jarvis-mode-chat")).toHaveAttribute(
      "aria-selected",
      "false"
    );
    // Voice mode is the keyboard taken away: no composer on the screen.
    expect(screen.queryByTestId("jarvis-composer")).toBeNull();
  });

  it("anchors the composer to the keyboard ALONE, never to the safe area too", () => {
    // `AppShell`'s chromeless column already carries
    // `env(safe-area-inset-bottom)`. A composer that folds the safe area in
    // again floats ~34px above the keys — the gap the owner reported. The
    // offset here must therefore be the keyboard variable and nothing else.
    renderScreen();
    fireEvent.click(screen.getByTestId("jarvis-mode-chat"));

    const composer = screen.getByTestId("jarvis-composer");
    const anchor = composer.parentElement;
    expect(anchor?.style.paddingBottom).toBe("var(--fm-keyboard-inset, 0px)");
    expect(anchor?.style.paddingBottom).not.toContain("safe-area");
  });
});
