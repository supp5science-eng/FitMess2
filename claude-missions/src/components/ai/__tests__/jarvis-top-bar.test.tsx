import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { JarvisTopBar } from "@/components/ai/jarvis-top-bar";

// The chrome above the Jarvis screen: settings, and the two-mode pill. The way
// OUT of the screen used to be the third piece here and now lives down the
// right edge -- see `jarvis-exit-rail.test.tsx`.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

describe("JarvisTopBar — mode pill", () => {
  it("test_top_bar_reports_the_mode_the_user_picked", () => {
    const onModeChange = vi.fn();
    render(<JarvisTopBar mode="voice" onModeChange={onModeChange} />);

    fireEvent.click(screen.getByTestId("jarvis-mode-chat"));

    expect(onModeChange).toHaveBeenCalledWith("chat");
  });

  it("test_top_bar_marks_the_active_segment_for_assistive_tech", () => {
    render(<JarvisTopBar mode="chat" onModeChange={vi.fn()} />);

    expect(screen.getByTestId("jarvis-mode-chat")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("jarvis-mode-voice")).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });
});
