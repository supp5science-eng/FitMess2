import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The wizard is now navigation-agnostic: on the final step it calls the
// `onComplete` prop with the collected `OnboardingData` instead of pushing a
// route. The parent flow (`/upitnik` pre-auth, `/onboarding` post-auth) owns
// what happens next, so these tests assert the hand-off payload directly.
const completeMock = vi.fn();

import { OnboardingWizard } from "../onboarding-wizard";
import type { OnboardingData } from "@/lib/onboarding/types";

// F015: component-level coverage for the onboarding wizard (AS-018, AS-019).
//
// AS-018 ("a newly verified user is routed through onboarding before
// reaching the home screen"): the middleware-level redirect is already
// covered live in src/app/(app)/onboarding/__tests__/onboarding-route.integration.test.ts
// (F013's original coverage plus this feature's own /danas-specific case);
// this file covers the other half -- that `/onboarding` actually renders a
// real first step, not a blank page or a 404.
//
// AS-019 ("onboarding collects sex, age, height, weight, activity level (5
// tiers), target weight, and timeframe"): walks the full wizard end to end,
// asserting each step's field, its inline Serbian validation, and that all
// seven values survive to the final hand-off URL.

beforeEach(() => {
  completeMock.mockClear();
});

/** Renders the wizard wired to the shared `completeMock` hand-off spy. */
function renderWizard() {
  return render(<OnboardingWizard onComplete={completeMock} />);
}

describe("AS-018: the wizard's first render is step 1 (pol) -- reachable, not blank", () => {
  it("test_AS_018_onboarding_wizard_renders_step_1_pol_by_default", () => {
    renderWizard();
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 7/)).toBeInTheDocument();
  });

  it("test_AS_018_step_1_offers_a_clear_next_action_button", () => {
    renderWizard();
    expect(
      screen.getByRole("button", { name: /Dalje/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 1 (pol) collects sex", () => {
  it("test_AS_019_pol_step_blocks_next_with_a_serbian_error_when_nothing_is_selected", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/pol/i);
    // Still on step 1 -- didn't advance.
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_pol_step_accepts_a_selection_and_advances_to_ime", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 2 od 7/)).toBeInTheDocument();
  });
});

describe("Onboarding step 2 (ime) collects the user's name", () => {
  it("test_ime_step_blocks_next_with_a_serbian_error_when_empty", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    // On the ime step with an empty field, Dalje must block and stay put.
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/ime/i);
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
  });

  it("test_ime_step_accepts_a_name_and_advances_to_godine", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    fireEvent.change(screen.getByLabelText(/Ime/), {
      target: { value: "Ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Kada si rođen/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 3 od 7/)).toBeInTheDocument();
  });
});

function advanceToStep(
  step: "ime" | "godine" | "visina" | "tezina" | "aktivnost" | "cilj-tip" | "cilj"
) {
  renderWizard();
  fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "ime") return;

  fireEvent.change(screen.getByLabelText(/Ime/), { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "godine") return;

  fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "visina") return;

  fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "175" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "tezina") return;

  fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "aktivnost") return;

  fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "cilj-tip") return;

  // Pick a weight-change goal so the target-weight ("cilj") step appears.
  fireEvent.click(screen.getByRole("radio", { name: /Smršaj/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
}

describe("AS-019: step 2 (godine) collects age", () => {
  it("test_AS_019_godine_step_blocks_next_with_a_serbian_error_when_no_age_is_picked", () => {
    advanceToStep("godine");
    // The step opens pre-filled with a sensible default; the reachable failure
    // is clearing it back to the placeholder and pressing Dalje.
    fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kada si rođen/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_godine_step_accepts_a_sane_age_and_advances_to_visina", () => {
    advanceToStep("godine");
    fireEvent.change(screen.getByLabelText(/Godine/), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja visina\?/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 3 (visina) collects height in cm", () => {
  it("test_AS_019_visina_step_blocks_next_with_a_serbian_error_when_no_height_is_picked", () => {
    advanceToStep("visina");
    fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja visina\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_visina_step_accepts_a_sane_height_and_advances_to_tezina", () => {
    advanceToStep("visina");
    fireEvent.change(screen.getByLabelText(/Visina/), {
      target: { value: "170" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja trenutna težina\?/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 4 (težina) collects weight in kg", () => {
  it("test_AS_019_tezina_step_blocks_next_with_a_serbian_error_when_no_weight_is_picked", () => {
    advanceToStep("tezina");
    fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja trenutna težina\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_tezina_step_accepts_a_sane_weight_and_advances_to_aktivnost", () => {
    advanceToStep("tezina");
    fireEvent.change(screen.getByLabelText(/Težina/), {
      target: { value: "80" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Koliko si aktivan\/aktivna\?/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 5 (nivo aktivnosti) collects one of 5 activity tiers", () => {
  it("test_AS_019_aktivnost_step_renders_all_five_tiers", () => {
    advanceToStep("aktivnost");
    expect(screen.getByRole("radio", { name: /Sedentaran/ })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Lagana aktivnost/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Umerena aktivnost/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Aktivan/ })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Veoma aktivan/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_aktivnost_step_blocks_next_with_a_serbian_error_when_nothing_is_selected", () => {
    advanceToStep("aktivnost");
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/aktivnost/i);
  });

  it("test_AS_019_aktivnost_step_accepts_a_tier_and_advances_to_goal_type", () => {
    advanceToStep("aktivnost");
    fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Koji ti je cilj\?/ })
    ).toBeInTheDocument();
  });
});

describe("goal type (cilj-tip) step drives the flow", () => {
  it("renders all four goals and blocks Dalje until one is picked", () => {
    advanceToStep("cilj-tip");
    expect(screen.getByRole("radio", { name: /Smršaj/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Održavanje/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Nabaci mišiće/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Zategni se/ })).toBeInTheDocument();

    // With no goal picked yet this is the last visible step, so the button
    // reads "Završi"; pressing it must still block on the missing goal.
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cilj/i);
  });

  it("a weight-change goal (Smršaj) reveals the target-weight step", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Smršaj/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByLabelText(/Ciljna težina/)).toBeInTheDocument();
  });

  it("Održavanje skips the target-weight step and finishes onto the plan reveal", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Održavanje/ }));
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.goal).toBe("maintain");
    expect(data.targetWeightKg).toBeNull();
    expect(data.timeframeWeeks).toBeNull();
  });
});

describe("AS-019: step 6 (cilj) collects target weight + timeframe", () => {
  it("test_AS_019_cilj_step_for_a_lose_goal_only_offers_target_weights_below_the_current_weight", () => {
    // advanceToStep picks Smršaj (lose) with a current weight of 80 kg.
    // The target-weight wheel must not even OFFER 80 (equal) or anything above
    // it -- a lower-than-current target can't be a wrong choice because a
    // not-lower value is never selectable in the first place.
    advanceToStep("cilj");
    const select = screen.getByLabelText(/Ciljna težina/) as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toContain("79");
    expect(values).toContain("35");
    expect(values).not.toContain("80"); // equal to current -- not allowed
    expect(values).not.toContain("85"); // above current -- not allowed for lose
  });

  it("test_gain_goal_only_offers_target_weights_above_the_current_weight", () => {
    // Same current weight (80 kg), but a Nabaci mišiće (gain) goal: now the wheel
    // must offer only weights ABOVE 80 and never 80 or below, so a target
    // lighter than the current weight can't be entered for a gain goal.
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.change(screen.getByLabelText(/Ime/), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Nabaci mišiće/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    const select = screen.getByLabelText(/Ciljna težina/) as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toContain("81");
    expect(values).toContain("300");
    expect(values).not.toContain("80"); // equal to current -- not allowed
    expect(values).not.toContain("79"); // below current -- not allowed for gain
  });

  it("test_AS_019_cilj_step_blocks_finish_when_the_timeframe_is_not_picked", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    // Leave "Rok" on its placeholder -- the wheel only offers >= 1 week.
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("test_AS_019_cilj_step_shows_a_big_friendly_preview_once_both_fields_are_sane", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    fireEvent.change(screen.getByLabelText(/^Rok/), {
      target: { value: "12" },
    });

    expect(screen.getByTestId("goal-preview")).toHaveTextContent(
      "-6 kg za 12 nedelja"
    );
  });

  it("test_AS_019_finishing_the_wizard_hands_all_seven_collected_values_to_the_summary_step", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    fireEvent.change(screen.getByLabelText(/^Rok/), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.name).toBe("Ana");
    expect(data.sex).toBe("female");
    expect(data.ageYears).toBe(30);
    expect(data.heightCm).toBe(175);
    expect(data.weightKg).toBe(80);
    expect(data.activityLevel).toBe("moderate");
    expect(data.targetWeightKg).toBe(74);
    expect(data.timeframeWeeks).toBe(12);
  });
});

describe("AS-019: Back navigation preserves previously entered data (nothing lost between screens)", () => {
  it("test_AS_019_going_back_and_forward_keeps_the_previously_selected_sex", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nazad/ }));
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Žensko/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("test_AS_019_back_button_is_not_shown_on_the_first_step", () => {
    renderWizard();
    expect(
      screen.queryByRole("button", { name: /Nazad/ })
    ).not.toBeInTheDocument();
  });
});

describe("F015 definition-of-done: forced-failure render test (inline Serbian error + retry, never blank)", () => {
  it("test_AS_019_an_invalid_step_never_blanks_the_screen_and_offers_a_working_retry_via_the_same_dalje_button", () => {
    renderWizard();

    // Force a failure: click Dalje with nothing selected.
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    // The screen is not blank -- the step's own heading and controls are
    // still fully rendered and interactive.
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Žensko/ })).toBeInTheDocument();

    // Retry: correct the input and press the same button again.
    fireEvent.click(screen.getByRole("radio", { name: /Muško/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
  });
});
