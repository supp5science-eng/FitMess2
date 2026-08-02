import { describe, expect, it } from "vitest";

import {
  FUNNEL_EVENTS,
  ONBOARDING_STEP_EVENT,
  PUSH_PROMPT_EVENT,
  isKnownFunnelEvent,
} from "@/lib/funnel/events";
import { ONBOARDING_STEP_IDS } from "@/lib/onboarding/types";

// The allow-list is the whole point of this module: `funnel_events` answers a
// small fixed set of questions, and a column anyone can write free strings into
// stops answering them within a week.

describe("isKnownFunnelEvent", () => {
  it("test_accepts_every_questionnaire_step", () => {
    for (const step of ONBOARDING_STEP_IDS) {
      expect(isKnownFunnelEvent(ONBOARDING_STEP_EVENT, step)).toBe(true);
    }
  });

  it("test_accepts_every_outcome_of_the_push_offer", () => {
    for (const value of FUNNEL_EVENTS[PUSH_PROMPT_EVENT]!) {
      expect(isKnownFunnelEvent(PUSH_PROMPT_EVENT, value)).toBe(true);
    }
  });

  it("test_rejects_an_invented_event_name", () => {
    expect(isKnownFunnelEvent("whatever", "pol")).toBe(false);
  });

  it("test_rejects_a_value_from_the_wrong_flow", () => {
    // A real value, but not of this event -- the pairing has to hold, or the
    // funnel and the prompt outcomes bleed into each other.
    expect(isKnownFunnelEvent(ONBOARDING_STEP_EVENT, "accepted")).toBe(false);
    expect(isKnownFunnelEvent(PUSH_PROMPT_EVENT, "pol")).toBe(false);
  });

  it("test_a_new_questionnaire_step_is_measured_without_being_listed_twice", () => {
    // The list is derived from ONBOARDING_STEP_IDS rather than copied, so a
    // step added to the wizard cannot silently drop out of the funnel.
    expect(FUNNEL_EVENTS[ONBOARDING_STEP_EVENT]).toBe(ONBOARDING_STEP_IDS);
  });
});
