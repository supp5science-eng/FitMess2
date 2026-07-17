import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { OnboardingWizard } from "../onboarding-wizard";

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
  pushMock.mockClear();
});

describe("AS-018: the wizard's first render is step 1 (pol) -- reachable, not blank", () => {
  it("test_AS_018_onboarding_wizard_renders_step_1_pol_by_default", () => {
    render(<OnboardingWizard />);
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 6/)).toBeInTheDocument();
  });

  it("test_AS_018_step_1_offers_a_clear_next_action_button", () => {
    render(<OnboardingWizard />);
    expect(
      screen.getByRole("button", { name: /Dalje/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 1 (pol) collects sex", () => {
  it("test_AS_019_pol_step_blocks_next_with_a_serbian_error_when_nothing_is_selected", () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/pol/i);
    // Still on step 1 -- didn't advance.
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("test_AS_019_pol_step_accepts_a_selection_and_advances_to_godine", () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Koliko imaš godina\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 2 od 6/)).toBeInTheDocument();
  });
});

function advanceToStep(step: "godine" | "visina" | "tezina" | "aktivnost" | "cilj") {
  render(<OnboardingWizard />);
  fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "godine") return;

  fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "visina") return;

  fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "170" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "tezina") return;

  fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "aktivnost") return;

  fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
}

describe("AS-019: step 2 (godine) collects age", () => {
  it("test_AS_019_godine_step_shows_a_serbian_error_for_an_out_of_range_age", () => {
    advanceToStep("godine");
    fireEvent.change(screen.getByLabelText(/Godine/), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Koliko imaš godina\?/ })
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
  it("test_AS_019_visina_step_shows_a_serbian_error_for_an_out_of_range_height", () => {
    advanceToStep("visina");
    fireEvent.change(screen.getByLabelText(/Visina/), {
      target: { value: "50" },
    });
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
  it("test_AS_019_tezina_step_shows_a_serbian_error_for_an_out_of_range_weight", () => {
    advanceToStep("tezina");
    fireEvent.change(screen.getByLabelText(/Težina/), {
      target: { value: "10" },
    });
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

  it("test_AS_019_aktivnost_step_accepts_a_tier_and_advances_to_cilj", () => {
    advanceToStep("aktivnost");
    fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));

    expect(
      screen.getByRole("heading", { name: /Koji je tvoj cilj\?/ })
    ).toBeInTheDocument();
  });
});

describe("AS-019: step 6 (cilj) collects target weight + timeframe", () => {
  it("test_AS_019_cilj_step_rejects_a_target_weight_that_is_not_below_the_current_weight", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "85" },
    });
    fireEvent.change(screen.getByLabelText(/^Rok/), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(/manja od trenutne/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("test_AS_019_cilj_step_rejects_a_timeframe_below_one_week", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    fireEvent.change(screen.getByLabelText(/^Rok/), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
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

    expect(pushMock).toHaveBeenCalledTimes(1);
    const url = pushMock.mock.calls[0][0] as string;
    expect(url.startsWith("/onboarding/pregled?")).toBe(true);

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pol")).toBe("female");
    expect(params.get("godine")).toBe("30");
    expect(params.get("visina")).toBe("170");
    expect(params.get("tezina")).toBe("80");
    expect(params.get("aktivnost")).toBe("moderate");
    expect(params.get("ciljnaTezina")).toBe("74");
    expect(params.get("nedelje")).toBe("12");
  });
});

describe("AS-019: Back navigation preserves previously entered data (nothing lost between screens)", () => {
  it("test_AS_019_going_back_and_forward_keeps_the_previously_selected_sex", () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koliko imaš godina\?/ })
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
    render(<OnboardingWizard />);
    expect(
      screen.queryByRole("button", { name: /Nazad/ })
    ).not.toBeInTheDocument();
  });
});

describe("F015 definition-of-done: forced-failure render test (inline Serbian error + retry, never blank)", () => {
  it("test_AS_019_an_invalid_step_never_blanks_the_screen_and_offers_a_working_retry_via_the_same_dalje_button", () => {
    render(<OnboardingWizard />);

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
      screen.getByRole("heading", { name: /Koliko imaš godina\?/ })
    ).toBeInTheDocument();
  });
});
