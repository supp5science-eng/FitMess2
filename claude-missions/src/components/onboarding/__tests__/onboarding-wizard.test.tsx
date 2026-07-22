import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The wizard is navigation-agnostic: on the final step it calls `onComplete`
// with the collected `OnboardingData` instead of pushing a route, so these
// tests assert the hand-off payload directly.
const completeMock = vi.fn();

import { OnboardingWizard } from "../onboarding-wizard";
import type { OnboardingData } from "@/lib/onboarding/types";

// AS-018/AS-019 component coverage for the onboarding wizard.
//
// Step order (F: reordered): pol → godine → visina → tezina → aktivnost →
// cilj-tip → ime → [cilj = ciljna težina] → [tempo = brzina]. The name moved
// late, and the two goal-only steps (target weight + pace) are conditional on
// a weight-change goal (lose/gain). maintain/tone finish right after `ime`.

beforeEach(() => {
  completeMock.mockClear();
});

function renderWizard() {
  return render(<OnboardingWizard onComplete={completeMock} />);
}

/**
 * Drives the wizard to the named step. Picks a weight-change goal (Smršaj) at
 * cilj-tip so the target-weight + tempo steps are reachable.
 */
function advanceToStep(
  step:
    | "godine"
    | "visina"
    | "tezina"
    | "aktivnost"
    | "cilj-tip"
    | "ime"
    | "cilj"
    | "tempo"
) {
  renderWizard();
  // pol
  fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "godine") return;
  // godine
  fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "visina") return;
  // visina
  fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "175" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "tezina") return;
  // tezina
  fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "aktivnost") return;
  // aktivnost
  fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "cilj-tip") return;
  // cilj-tip -> pick Smršaj (lose) so target + tempo appear
  fireEvent.click(screen.getByRole("radio", { name: /Smršaj/ }));
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "ime") return;
  // ime
  fireEvent.change(screen.getByLabelText(/Ime/), { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
  if (step === "cilj") return;
  // cilj (target weight ruler)
  fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
    target: { value: "74" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
}

describe("AS-018: the wizard opens on pol (step 1 of 7)", () => {
  it("renders step 1 (pol) with a progress count and a next button", () => {
    renderWizard();
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 7/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dalje/ })).toBeInTheDocument();
  });

  it("blocks Dalje on pol with a Serbian error until a sex is picked", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/pol/i);
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
  });

  it("pol advances to godine (step 2 of 7) — name is no longer step 2", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koliko imaš godina\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 2 od 7/)).toBeInTheDocument();
  });
});

describe("AS-019: demographic steps collect and validate in the new order", () => {
  it("godine → visina", () => {
    advanceToStep("godine");
    fireEvent.change(screen.getByLabelText(/Godine/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja visina\?/ })
    ).toBeInTheDocument();
  });

  it("visina → tezina", () => {
    advanceToStep("visina");
    fireEvent.change(screen.getByLabelText(/Visina/), { target: { value: "175" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Kolika je tvoja trenutna težina\?/ })
    ).toBeInTheDocument();
  });

  it("tezina → aktivnost", () => {
    advanceToStep("tezina");
    fireEvent.change(screen.getByLabelText(/Težina/), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koliko si aktivan/ })
    ).toBeInTheDocument();
  });

  it("aktivnost → cilj-tip", () => {
    advanceToStep("aktivnost");
    fireEvent.click(screen.getByRole("radio", { name: /Umerena aktivnost/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koji ti je cilj\?/ })
    ).toBeInTheDocument();
  });
});

describe("cilj-tip drives which steps follow, and name comes after it", () => {
  it("a weight-change goal (Smršaj) is followed by the name step (step 7 of 9)", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Smršaj/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 7 od 9/)).toBeInTheDocument();
  });

  it("Održavanje finishes right after the name step (no target/pace)", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Održavanje/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    // Now on the name step, which is the LAST step (7 of 7) for maintain.
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 7 od 7/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Ime/), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.goal).toBe("maintain");
    expect(data.name).toBe("Ana");
    expect(data.targetWeightKg).toBeNull();
    expect(data.timeframeWeeks).toBeNull();
  });
});

describe("ime step (now after cilj-tip)", () => {
  it("blocks Dalje when the name is empty", () => {
    advanceToStep("ime");
    expect(
      screen.getByRole("heading", { name: /Kako se zoveš\?/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/ime/i);
  });

  it("accepts a name and advances to the target-weight step", () => {
    advanceToStep("ime");
    fireEvent.change(screen.getByLabelText(/Ime/), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koja ti je ciljna težina\?/ })
    ).toBeInTheDocument();
  });
});

describe("cilj step: target weight via the ruler", () => {
  it("only offers target weights below the current weight for a lose goal", () => {
    advanceToStep("cilj");
    const select = screen.getByLabelText(/Ciljna težina/) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("79");
    expect(values).toContain("35");
    expect(values).not.toContain("80"); // equal to current — not allowed
    expect(values).not.toContain("85"); // above current — not allowed for lose
  });

  it("advances to the tempo step (step 9 of 9)", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koliko brzo želiš da stigneš do cilja\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 9 od 9/)).toBeInTheDocument();
  });
});

describe("tempo step: pace slider (last step for weight-change goals)", () => {
  it("renders the three paces and a slider, defaulting to recommended", () => {
    advanceToStep("tempo");
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sporo/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Preporučeno/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Brzo/ })).toBeInTheDocument();
    // Recommended default: 0,5 kg/week readout.
    expect(screen.getByText(/0,5 kg/)).toBeInTheDocument();
    // Live daily-calorie preview is shown.
    expect(screen.getByTestId("tempo-daily-kcal")).toBeInTheDocument();
  });

  it("changing the pace updates the weekly-change readout", () => {
    advanceToStep("tempo");
    fireEvent.click(screen.getByRole("button", { name: /Sporo/ }));
    expect(screen.getByText(/0,25 kg/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Brzo/ }));
    expect(screen.getByText(/0,75 kg/)).toBeInTheDocument();
  });

  it("finishing hands off target weight + a timeframe derived from the pace", () => {
    advanceToStep("tempo");
    // Default pace = recommended (0.5 kg/week); delta 80 -> 74 = 6 kg -> 12 weeks.
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.name).toBe("Ana");
    expect(data.sex).toBe("female");
    expect(data.ageYears).toBe(30);
    expect(data.heightCm).toBe(175);
    expect(data.weightKg).toBe(80);
    expect(data.activityLevel).toBe("moderate");
    expect(data.goal).toBe("lose");
    expect(data.targetWeightKg).toBe(74);
    expect(data.pace).toBe("recommended");
    expect(data.timeframeWeeks).toBe(12);
  });

  it("a slower pace yields a longer derived timeframe", () => {
    advanceToStep("tempo");
    fireEvent.click(screen.getByRole("button", { name: /Sporo/ }));
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    const data = completeMock.mock.calls[0][0] as OnboardingData;
    // 6 kg at 0.25 kg/week -> 24 weeks.
    expect(data.pace).toBe("slow");
    expect(data.timeframeWeeks).toBe(24);
  });
});

describe("Back navigation preserves previously entered data", () => {
  it("going back to pol keeps the selected sex", () => {
    renderWizard();
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

  it("no Back button on the first step", () => {
    renderWizard();
    expect(
      screen.queryByRole("button", { name: /Nazad/ })
    ).not.toBeInTheDocument();
  });
});
