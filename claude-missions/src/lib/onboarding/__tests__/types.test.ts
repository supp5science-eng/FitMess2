import { describe, expect, it } from "vitest";

import {
  buildOnboardingSummaryUrl,
  EMPTY_ONBOARDING_DATA,
  ONBOARDING_SUMMARY_PATH,
} from "../types";
import type { OnboardingData } from "../types";

// F015 / AS-019: proves the wizard's collected data (all seven inputs) is
// carried forward to F016's summary step intact -- "hand the collected
// values to the summary step" per the clarified spec. F016 itself (the
// page at ONBOARDING_SUMMARY_PATH) is out of this feature's scope; this
// only proves the handoff payload this feature builds is complete and
// correctly encoded.

const FULL_DATA: OnboardingData = {
  sex: "female",
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  activityLevel: "moderate",
  targetWeightKg: 70.5,
  timeframeWeeks: 16,
};

describe("AS-019: buildOnboardingSummaryUrl carries all seven collected inputs to F016", () => {
  it("test_AS_019_url_targets_the_onboarding_summary_path", () => {
    const url = buildOnboardingSummaryUrl(FULL_DATA);
    expect(url.startsWith(`${ONBOARDING_SUMMARY_PATH}?`)).toBe(true);
  });

  it("test_AS_019_url_encodes_sex", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("pol")).toBe("female");
  });

  it("test_AS_019_url_encodes_age", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("godine")).toBe("29");
  });

  it("test_AS_019_url_encodes_height", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("visina")).toBe("168");
  });

  it("test_AS_019_url_encodes_weight", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("tezina")).toBe("80");
  });

  it("test_AS_019_url_encodes_activity_level", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("aktivnost")).toBe("moderate");
  });

  it("test_AS_019_url_encodes_target_weight_and_timeframe", () => {
    const params = new URLSearchParams(
      buildOnboardingSummaryUrl(FULL_DATA).split("?")[1]
    );
    expect(params.get("ciljnaTezina")).toBe("70.5");
    expect(params.get("nedelje")).toBe("16");
  });

  it("test_AS_019_url_omits_unset_fields_rather_than_writing_null_or_undefined", () => {
    const url = buildOnboardingSummaryUrl(EMPTY_ONBOARDING_DATA);
    expect(url).toBe(`${ONBOARDING_SUMMARY_PATH}?`);
    expect(url).not.toMatch(/null|undefined/);
  });
});
