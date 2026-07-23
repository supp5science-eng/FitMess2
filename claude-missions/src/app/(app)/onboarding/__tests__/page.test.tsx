import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// The plan-reveal pulls in a `"use server"` action graph (Supabase server
// client) that isn't relevant to this page test and can't run in jsdom. We
// only care that `/onboarding` renders the questionnaire when there's no
// pre-auth hand-off waiting, so stub the reveal to a marker.
vi.mock("@/components/onboarding/plan-reveal", () => ({
  PlanReveal: () => <div data-testid="plan-reveal" />,
}));

import OnboardingPage from "../page";

// AS-018: the page the F013 middleware redirect (verified-but-not-onboarded ->
// `/onboarding`) lands on. Onboarding now runs pre-auth on `/upitnik`, so this
// page has two jobs: pick up stashed answers and persist them (the plan
// reveal), or — when there are none (a direct/Google signup) — run the
// questionnaire itself. With an empty `localStorage` it must fall back to the
// wizard's first step, never a blank page or a 404.

beforeEach(() => {
  window.localStorage.clear();
});

const COMPLETE_STASH = {
  name: null,
  sex: "female",
  ageYears: 30,
  heightCm: 170,
  weightKg: 68,
  activityLevel: "moderate",
  goal: "lose",
  targetWeightKg: 62,
  pace: "recommended",
  timeframeWeeks: 12,
};

describe("the pre-auth hand-off resumes with the name question, then the plan", () => {
  it("stashed answers WITHOUT a name land on the 'Kako da te zovemo?' screen", () => {
    window.localStorage.setItem(
      "fm_onboarding",
      JSON.stringify(COMPLETE_STASH)
    );
    render(<OnboardingPage />);
    expect(
      screen.getByRole("heading", { name: /Kako da te zovemo\?/ })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("plan-reveal")).not.toBeInTheDocument();
  });

  it("stashed answers WITH a name (post-retry reload) skip straight to the plan", () => {
    window.localStorage.setItem(
      "fm_onboarding",
      JSON.stringify({ ...COMPLETE_STASH, name: "Ana" })
    );
    render(<OnboardingPage />);
    expect(screen.getByTestId("plan-reveal")).toBeInTheDocument();
  });
});

describe("AS-018: /onboarding falls back to the questionnaire when no answers are stashed", () => {
  it("test_AS_018_onboarding_page_renders_the_pol_step_heading", () => {
    render(<OnboardingPage />);
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_renders_a_progress_indicator", () => {
    render(<OnboardingPage />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
    // First step of the wizard (total step count is owned by the wizard).
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(/Korak 1 od/)).toBeInTheDocument();
  });

  it("test_AS_018_onboarding_page_is_not_blank", () => {
    const { container } = render(<OnboardingPage />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
