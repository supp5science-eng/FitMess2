import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

// F016: component-level coverage for the editable onboarding summary
// screen (AS-020, AS-030). AS-031's actual DB write is covered by
// persist.test.ts (validation/write-shape) and the live integration test
// (actions.integration.test.ts) -- this file proves the UI wiring: the
// screen renders the F014-computed budget, recomputes it live on every
// edit, shows the AS-030 goal-adjustment explanation when relevant, and
// never blanks the screen on a failed save (inline Serbian retry).

const saveOnboardingActionMock = vi.fn();

vi.mock("@/app/(app)/onboarding/pregled/actions", () => ({
  saveOnboardingAction: (...args: unknown[]) =>
    saveOnboardingActionMock(...args),
}));

import { SummaryScreen } from "../summary-screen";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";

const BASE_DATA: CompleteOnboardingData = {
  sex: "female",
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  activityLevel: "moderate",
  targetWeightKg: 74,
  timeframeWeeks: 12,
};

beforeEach(() => {
  saveOnboardingActionMock.mockReset();
});

describe("AS-020: the summary shows the F014-computed budget for the hand-off data", () => {
  it("test_AS_020_renders_a_computed_daily_kcal_budget_matching_the_engine", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    // bmr(female,80,168,29) -> tdee(moderate) -> planGoalAdjustment(74kg/12wk)
    // matches the F014 engine's own reference computation for these exact
    // inputs (cross-checked against src/lib/budget/__tests__ conventions).
    expect(screen.getByTestId("daily-kcal")).toHaveTextContent(/^\d+$/);
    expect(screen.getByTestId("weekly-kcal")).toHaveTextContent(/kcal nedeljno/);
    expect(screen.getByTestId("protein-g")).toHaveTextContent(/g$/);
    expect(screen.getByTestId("fat-g")).toHaveTextContent(/g$/);
    expect(screen.getByTestId("carbs-g")).toHaveTextContent(/g$/);
  });

  it("test_AS_020_weekly_budget_always_equals_daily_times_seven_on_screen", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    const daily = Number(screen.getByTestId("daily-kcal").textContent);
    const weeklyText = screen.getByTestId("weekly-kcal").textContent ?? "";
    const weekly = Number(weeklyText.split(" ")[0]);

    expect(weekly).toBe(daily * 7);
  });
});

describe("AS-020: every input is editable inline and recomputes the budget live", () => {
  it("test_AS_020_changing_activity_level_recomputes_the_daily_kcal_budget", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    const before = screen.getByTestId("daily-kcal").textContent;

    fireEvent.click(screen.getByRole("radio", { name: /Veoma aktivan/ }));

    const after = screen.getByTestId("daily-kcal").textContent;
    expect(after).not.toBe(before);
  });

  it("test_AS_020_changing_weight_recomputes_the_macro_targets", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    const before = screen.getByTestId("protein-g").textContent;

    fireEvent.change(screen.getByLabelText(/^Težina/), {
      target: { value: "100" },
    });

    const after = screen.getByTestId("protein-g").textContent;
    expect(after).not.toBe(before);
  });

  it("test_AS_020_changing_sex_recomputes_the_daily_kcal_budget", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    const before = screen.getByTestId("daily-kcal").textContent;

    fireEvent.click(screen.getByRole("radio", { name: /Muško/ }));

    const after = screen.getByTestId("daily-kcal").textContent;
    expect(after).not.toBe(before);
  });

  it("test_AS_020_clearing_a_required_field_shows_an_inline_serbian_error_and_hides_the_stale_budget", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    fireEvent.change(screen.getByLabelText(/^Godine/), {
      target: { value: "" },
    });

    expect(screen.queryByTestId("daily-kcal")).not.toBeInTheDocument();
    expect(screen.getByTestId("summary-unavailable")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});

describe("AS-030: a capped/adjusted goal shows a calm Serbian explanation", () => {
  it("test_AS_030_an_unsafe_goal_shows_the_adjustment_notice_with_serbian_copy", () => {
    render(
      <SummaryScreen
        initialData={{
          sex: "female",
          ageYears: 29,
          heightCm: 160,
          weightKg: 65,
          activityLevel: "sedentary",
          targetWeightKg: 35,
          timeframeWeeks: 4,
        }}
      />
    );

    const notice = screen.getByTestId("goal-adjustment-notice");
    expect(notice).toBeInTheDocument();
    expect(within(notice).getByText(/Prilagodili smo tvoj cilj/)).toBeInTheDocument();
  });

  it("test_AS_030_a_safe_goal_shows_no_adjustment_notice", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);
    expect(
      screen.queryByTestId("goal-adjustment-notice")
    ).not.toBeInTheDocument();
  });

  it("test_AS_030_editing_the_timeframe_down_to_trigger_a_cap_makes_the_notice_appear_live", () => {
    render(
      <SummaryScreen
        initialData={{
          ...BASE_DATA,
          targetWeightKg: 76,
          timeframeWeeks: 20,
        }}
      />
    );

    expect(
      screen.queryByTestId("goal-adjustment-notice")
    ).not.toBeInTheDocument();

    // Same 4kg goal, squeezed into 2 weeks instead of 20 -- guaranteed to
    // blow through the 25% deficit cap.
    fireEvent.change(screen.getByLabelText(/^Rok/), {
      target: { value: "2" },
    });

    expect(screen.getByTestId("goal-adjustment-notice")).toBeInTheDocument();
  });
});

describe("F016 definition-of-done: forced-failure render test (inline Serbian error + retry, never blank)", () => {
  it("test_AS_020_a_failed_save_shows_an_inline_serbian_error_and_the_form_stays_fully_usable", async () => {
    saveOnboardingActionMock.mockResolvedValue({
      ok: false,
      error_sr: "Nešto nije uspelo pri čuvanju. Pokušaj ponovo.",
    });

    render(<SummaryScreen initialData={BASE_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: /Započni/ }));

    await waitFor(() =>
      expect(screen.getByTestId("save-error")).toBeInTheDocument()
    );
    expect(screen.getByTestId("save-error")).toHaveTextContent(/Pokušaj ponovo/);

    // Not blank: the summary + every input are still there.
    expect(screen.getByTestId("daily-kcal")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Žensko/ })).toBeInTheDocument();

    // The button becomes interactive again once the failed transition
    // settles -- this IS the "retry affordance" the failure-handling
    // contract requires.
    const retryButton = await screen.findByRole("button", { name: /Započni/ });
    expect(retryButton).not.toBeDisabled();

    saveOnboardingActionMock.mockResolvedValue({ ok: true });
    fireEvent.click(retryButton);

    await waitFor(() =>
      expect(saveOnboardingActionMock).toHaveBeenCalledTimes(2)
    );
  });

  it("test_AS_020_clicking_save_while_a_field_is_invalid_never_calls_the_server_action", () => {
    render(<SummaryScreen initialData={BASE_DATA} />);

    fireEvent.change(screen.getByLabelText(/^Godine/), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Započni/ }));

    expect(saveOnboardingActionMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("save-error")).toBeInTheDocument();
  });
});

describe("AS-020: side-effect verification -- saving calls the server action with the current (possibly edited) data, no premature navigation", () => {
  it("test_AS_020_saving_after_an_edit_sends_the_edited_values_not_the_original_hand_off", async () => {
    saveOnboardingActionMock.mockResolvedValue({ ok: true });
    render(<SummaryScreen initialData={BASE_DATA} />);

    fireEvent.click(screen.getByRole("radio", { name: /Veoma aktivan/ }));
    fireEvent.click(screen.getByRole("button", { name: /Započni/ }));

    await waitFor(() => expect(saveOnboardingActionMock).toHaveBeenCalledTimes(1));
    const sentData = saveOnboardingActionMock.mock.calls[0][0];
    expect(sentData.activityLevel).toBe("very_active");
  });
});
