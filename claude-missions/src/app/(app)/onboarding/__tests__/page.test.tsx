import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import OnboardingPage from "../page";

// F015 / AS-018: the actual page component the F013 middleware redirect
// (verified-but-not-onboarded -> `/onboarding`) lands on. It now opens on the
// animated post-login welcome; tapping "Započni upitnik" reveals the wizard's
// first step. Proves the route renders the flow, not the 404 documented as
// expected/pending in the F013 handoff.

describe("AS-018: /onboarding welcome then wizard's first step", () => {
  it("test_AS_018_onboarding_page_opens_on_the_welcome_screen", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByRole("heading", { name: /Uspešno si se prijavio/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Započni upitnik/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_the_pol_step_heading", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Započni upitnik/ }));
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_a_progress_indicator", () => {
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole("button", { name: /Započni upitnik/ }));
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 6/)).toBeInTheDocument();
  });
});
