import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F016: the actual route (`/onboarding/pregled`) F015's wizard hands off to.
// Proves the route renders the animated plan-reveal (not a 404, matching the
// F013 -> F015 -> F016 precedent each feature documents), and that an
// incomplete/missing hand-off renders the clarified "friendly Serbian empty
// state with a clear next action" instead of crashing the budget engine.

const finishOnboardingActionMock = vi.fn();
finishOnboardingActionMock.mockResolvedValue({ ok: true });
vi.mock("@/app/(app)/onboarding/pregled/actions", () => ({
  finishOnboardingAction: (...args: unknown[]) =>
    finishOnboardingActionMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

import OnboardingPregledPage from "../page";

const COMPLETE_PARAMS = {
  pol: "female",
  godine: "29",
  visina: "168",
  tezina: "80",
  aktivnost: "moderate",
  ciljnaTezina: "74",
  nedelje: "12",
};

describe("AS-020: /onboarding/pregled plays the plan-reveal when the hand-off is complete", () => {
  it("test_AS_020_renders_the_calculating_reveal_for_a_full_query_string", async () => {
    const ui = await OnboardingPregledPage({
      searchParams: Promise.resolve(COMPLETE_PARAMS),
    });
    render(ui);

    // The reveal opens on its calculating phase.
    expect(
      await screen.findByText(/Računamo tvoj plan/)
    ).toBeInTheDocument();
    // And persists the onboarding data in the background.
    expect(finishOnboardingActionMock).toHaveBeenCalledTimes(1);
  });
});

describe("AS-020 empty state: a missing or partial hand-off never crashes the budget engine", () => {
  it("test_AS_020_no_query_string_at_all_renders_the_serbian_empty_state_not_a_crash", async () => {
    const ui = await OnboardingPregledPage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(
      screen.getByRole("heading", { name: /Nedostaju neki podaci/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Nazad na upitnik/ })
    ).toHaveAttribute("href", "/onboarding");
    expect(screen.queryByTestId("daily-kcal")).not.toBeInTheDocument();
  });

  it("test_AS_020_a_partial_hand_off_missing_one_field_also_renders_the_empty_state", async () => {
    const partial = { ...COMPLETE_PARAMS };
    delete (partial as Partial<typeof COMPLETE_PARAMS>).nedelje;
    const ui = await OnboardingPregledPage({
      searchParams: Promise.resolve(partial),
    });
    render(ui);

    expect(
      screen.getByRole("heading", { name: /Nedostaju neki podaci/ })
    ).toBeInTheDocument();
  });
});
