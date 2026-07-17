import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import OnboardingPage from "../page";

// F015 / AS-018: the actual page component the F013 middleware redirect
// (verified-but-not-onboarded -> `/onboarding`) lands on. Proves the route
// itself renders the wizard's first step, not the 404 documented as
// expected/pending in the F013 handoff.

describe("AS-018: /onboarding renders the wizard's first step", () => {
  it("test_AS_018_onboarding_page_renders_the_pol_step_heading", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_a_progress_indicator", () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 6/)).toBeInTheDocument();
  });
});
