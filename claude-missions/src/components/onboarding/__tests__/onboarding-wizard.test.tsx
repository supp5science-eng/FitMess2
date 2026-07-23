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
// Step order: pol → godine → visina → tezina → aktivnost → cilj-tip →
// [cilj = ciljna težina] → [tempo = brzina]. The questionnaire is anonymous —
// the name is asked post-registration (see `name-screen.tsx`), NOT here. The
// two goal-only steps (target weight + pace) are conditional on a
// weight-change goal (lose/gain); maintain/tone finish right at `cilj-tip`.

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
  if (step === "cilj") return;
  // cilj (target weight ruler)
  fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
    target: { value: "74" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
}

describe("AS-018: the wizard opens on pol (step 1 of 6)", () => {
  it("renders step 1 (pol) with a progress count and a next button", () => {
    renderWizard();
    expect(
      screen.getByRole("heading", { name: /Koji je tvoj pol\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 1 od 6/)).toBeInTheDocument();
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

  it("pol advances to godine (step 2 of 6)", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("radio", { name: /Žensko/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Kada si rođen/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 2 od 6/)).toBeInTheDocument();
  });
});

describe("AS-019: demographic steps collect and validate in order", () => {
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

describe("the wizard never asks for a name (the questionnaire is anonymous)", () => {
  it("no step renders the name question; the hand-off carries name: null", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Održavanje/ }));
    expect(
      screen.queryByRole("heading", { name: /Kako se zoveš\?/ })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.name).toBeNull();
  });
});

describe("cilj-tip drives which steps follow", () => {
  it("a weight-change goal (Smršaj) is followed by the target-weight step (step 7 of 8)", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Smršaj/ }));
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koja ti je ciljna težina\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 7 od 8/)).toBeInTheDocument();
  });

  it("Održavanje finishes right at cilj-tip (no target/pace)", () => {
    advanceToStep("cilj-tip");
    fireEvent.click(screen.getByRole("radio", { name: /Održavanje/ }));
    // cilj-tip is the LAST step (6 of 6) for maintain.
    expect(screen.getByText(/Korak 6 od 6/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.goal).toBe("maintain");
    expect(data.targetWeightKg).toBeNull();
    expect(data.timeframeWeeks).toBeNull();
  });
});

describe("cilj step: target weight via the ruler", () => {
  it("seeds a target weight below the current weight for a lose goal", () => {
    advanceToStep("cilj");
    // The ruler opens seeded on a real target that must sit below the current
    // weight (80) for a lose goal — the restriction is enforced by only
    // offering below-current values, so the seeded value proves it.
    const input = screen.getByLabelText(/Ciljna težina/) as HTMLInputElement;
    const seeded = Number(input.value);
    expect(seeded).toBeGreaterThan(0);
    expect(seeded).toBeLessThan(80);
  });

  it("advances to the tempo step (step 8 of 8)", () => {
    advanceToStep("cilj");
    fireEvent.change(screen.getByLabelText(/Ciljna težina/), {
      target: { value: "74" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Dalje/ }));
    expect(
      screen.getByRole("heading", { name: /Koliko brzo želiš da stigneš do cilja\?/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Korak 8 od 8/)).toBeInTheDocument();
  });
});

describe("tempo step: continuous pace dial (last step for weight-change goals)", () => {
  it("opens on the recommended pace by default, with a daily-kcal preview", () => {
    advanceToStep("tempo");
    // The dial is driven by a hidden, labeled range slider (source of truth).
    const slider = screen.getByLabelText(
      /Tempo dostizanja cilja/
    ) as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    // Default sits at the midpoint (recommended, 0.5 kg/week).
    expect(slider.value).toBe("500");
    expect(screen.getByText(/Preporučeno/)).toBeInTheDocument();
    expect(screen.getByText(/0,5 kg nedeljno/)).toBeInTheDocument();
    // Live daily-calorie preview is shown.
    expect(screen.getByTestId("tempo-daily-kcal")).toBeInTheDocument();
  });

  it("dragging the dial toward slow relabels it and slows the rate", () => {
    advanceToStep("tempo");
    fireEvent.change(screen.getByLabelText(/Tempo dostizanja cilja/), {
      target: { value: "0" },
    });
    expect(screen.getByText(/Sporo/)).toBeInTheDocument();
    expect(screen.getByText(/0,25 kg nedeljno/)).toBeInTheDocument();
  });

  it("finishing hands off target weight + a timeframe derived from the dial", () => {
    advanceToStep("tempo");
    // Default position = recommended (0.5 kg/week); delta 80 -> 74 = 6 kg -> 12 weeks.
    fireEvent.click(screen.getByRole("button", { name: /Završi/ }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const data = completeMock.mock.calls[0][0] as OnboardingData;
    expect(data.name).toBeNull();
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

  it("a slower dial position yields a longer derived timeframe", () => {
    advanceToStep("tempo");
    fireEvent.change(screen.getByLabelText(/Tempo dostizanja cilja/), {
      target: { value: "0" },
    });
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
      screen.getByRole("heading", { name: /Kada si rođen/ })
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
