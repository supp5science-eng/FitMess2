import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import OnboardingPage from "../page";

// F015 / AS-018: the actual page component the F013 middleware redirect
// (verified-but-not-onboarded -> `/onboarding`) lands on. It now opens on the
// animated post-login welcome; tapping "Započni upitnik" offers a one-time
// light/dark theme choice, then continues into the wizard's first step. Proves
// the route renders the flow, not the 404 documented as expected/pending in
// the F013 handoff.

/** Welcome -> theme choice -> wizard. */
function advanceToWizard() {
  fireEvent.click(screen.getByRole("button", { name: /Započni upitnik/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Nastavi$/ }));
}

describe("AS-018: /onboarding welcome, theme choice, then wizard's first step", () => {
  it("test_AS_018_onboarding_page_opens_on_the_welcome_screen", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByRole("heading", { name: /Uspešno si se prijavio/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Započni upitnik/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_offers_a_light_dark_theme_choice_right_after_the_welcome", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Započni upitnik/ }));
    expect(
      screen.getByRole("heading", { name: /Izaberi izgled/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Svetla/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tamna/ })).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_the_pol_step_heading", () => {
    render(<OnboardingPage />);
    advanceToWizard();
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_a_progress_indicator", () => {
    render(<OnboardingPage />);
    advanceToWizard();
    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
    // First step of the wizard (total step count is owned by the wizard).
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(/Korak 1 od/)).toBeInTheDocument();
  });
});
