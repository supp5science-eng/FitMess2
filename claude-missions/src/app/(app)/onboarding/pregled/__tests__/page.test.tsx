import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// F016: the actual route (`/onboarding/pregled`) F015's wizard hands off
// to. Proves the route renders the real summary (not a 404, matching the
// F013 -> F015 -> F016 precedent each feature documents), and that an
// incomplete/missing hand-off renders the clarified "friendly Serbian
// empty state with a clear next action" instead of crashing.

const saveOnboardingActionMock = vi.fn();
vi.mock("@/app/(app)/onboarding/pregled/actions", () => ({
  saveOnboardingAction: (...args: unknown[]) =>
    saveOnboardingActionMock(...args),
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

describe("AS-020: /onboarding/pregled renders the editable summary when the hand-off is complete", () => {
  it("test_AS_020_renders_the_summary_screen_with_a_computed_budget_for_a_full_query_string", async () => {
    const ui = await OnboardingPregledPage({
      searchParams: Promise.resolve(COMPLETE_PARAMS),
    });
    render(ui);

    expect(screen.getByTestId("daily-kcal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Tvoj plan/ })
    ).toBeInTheDocument();
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
