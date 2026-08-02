"use client";

import {
  ADD_FLOW_EVENT,
  ONBOARDING_STEP_EVENT,
  PUSH_PROMPT_EVENT,
  type AddFlowValue,
  type PushPromptValue,
} from "@/lib/funnel/events";

/**
 * Client half of the funnel instrumentation: fire-and-forget.
 *
 * Nothing the user does may ever wait on, or fail because of, a measurement.
 * So this returns void, swallows every error, and uses `keepalive` so a point
 * reached on the way out of the app (the last step before someone closes the
 * tab — exactly the one worth knowing about) still lands.
 */
function record(event: string, value: string): void {
  try {
    void fetch("/api/dogadjaj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, value }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Measurement is never worth an exception on a user's screen.
  }
}

/** A questionnaire step was shown. `value` is the step id. */
export function recordOnboardingStep(stepId: string): void {
  record(ONBOARDING_STEP_EVENT, stepId);
}

/** What became of the notification-permission offer. */
export function recordPushPrompt(value: PushPromptValue): void {
  record(PUSH_PROMPT_EVENT, value);
}

/**
 * The way into logging: the "+" menu opening, and which entry was chosen.
 *
 * Paired with `logs`, this separates "never even opened the menu" from
 * "opened it, picked a way in, and did not come out with a meal" — the two
 * halves of the only gap that currently matters.
 */
export function recordAddFlow(value: AddFlowValue): void {
  record(ADD_FLOW_EVENT, value);
}
