import { describe, expect, it, beforeEach } from "vitest";

import {
  PENDING_ONBOARDING_KEY,
  clearPendingOnboarding,
  readCompletePendingOnboarding,
  readPendingOnboarding,
  savePendingOnboarding,
} from "@/lib/onboarding/storage";
import type { OnboardingData } from "@/lib/onboarding/types";

// Unit coverage for the pre-auth onboarding stash (`localStorage`). This is
// what lets the questionnaire run logged-out on `/upitnik` and still have the
// answers survive registration + email verification so the post-auth
// `/onboarding` can persist them. jsdom provides a real `localStorage`.

const COMPLETE: OnboardingData = {
  name: "Ana",
  sex: "female",
  ageYears: 30,
  heightCm: 170,
  weightKg: 68,
  activityLevel: "moderate",
  goal: "lose",
  targetWeightKg: 62,
  timeframeWeeks: 12,
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("savePendingOnboarding / readPendingOnboarding round-trip", () => {
  it("reads back exactly what was saved", () => {
    savePendingOnboarding(COMPLETE);
    expect(readPendingOnboarding()).toEqual(COMPLETE);
  });

  it("writes under the documented key", () => {
    savePendingOnboarding(COMPLETE);
    expect(window.localStorage.getItem(PENDING_ONBOARDING_KEY)).toBeTruthy();
  });

  it("returns null when nothing is stored", () => {
    expect(readPendingOnboarding()).toBeNull();
  });

  it("returns null (never throws) on a malformed blob", () => {
    window.localStorage.setItem(PENDING_ONBOARDING_KEY, "{not json");
    expect(readPendingOnboarding()).toBeNull();
  });

  it("only copies recognised OnboardingData fields off the stored object", () => {
    window.localStorage.setItem(
      PENDING_ONBOARDING_KEY,
      JSON.stringify({ ...COMPLETE, hacked: "x", __proto__: { polluted: 1 } })
    );
    const result = readPendingOnboarding();
    expect(result).toEqual(COMPLETE);
    expect(result as unknown as Record<string, unknown>).not.toHaveProperty(
      "hacked"
    );
  });
});

describe("readCompletePendingOnboarding", () => {
  it("returns the data when every required field is present", () => {
    savePendingOnboarding(COMPLETE);
    expect(readCompletePendingOnboarding()).toEqual(COMPLETE);
  });

  it("returns null when the stored answers are incomplete", () => {
    savePendingOnboarding({ ...COMPLETE, weightKg: null });
    expect(readCompletePendingOnboarding()).toBeNull();
  });
});

describe("clearPendingOnboarding", () => {
  it("removes the stashed answers", () => {
    savePendingOnboarding(COMPLETE);
    clearPendingOnboarding();
    expect(readPendingOnboarding()).toBeNull();
  });
});
