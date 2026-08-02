/**
 * Funnel events: the named points in a flow we want to know people reached.
 *
 * This module is the ALLOW-LIST, shared by the client helper and the route
 * that writes the row. The client never sends a free string: `funnel_events`
 * exists to answer a small, fixed set of questions, and a table anyone can
 * write arbitrary labels into stops answering them within a week.
 *
 * Deliberately tiny in what it records — see the migration (0028) for why the
 * shape is "first time reached" and nothing else.
 */

import { ONBOARDING_STEP_IDS } from "@/lib/onboarding/types";

/** Which step of the post-signup questionnaire a user has been SHOWN. */
export const ONBOARDING_STEP_EVENT = "onboarding_step";

/** What became of the notification-permission offer. */
export const PUSH_PROMPT_EVENT = "push_prompt";

/**
 * The outcomes of the push offer.
 *
 * `needs_install` is the one that motivated the instrumentation: on iPhone the
 * offer cannot be made at all outside an installed Home Screen app, and until
 * now that case was silent — indistinguishable, in the numbers, from people
 * seeing the offer and refusing it.
 */
export const PUSH_PROMPT_VALUES = [
  "shown",
  "accepted",
  "declined",
  /** The browser refused permission — there is no second prompt after this. */
  "denied",
  /** iPhone in a Safari tab: cannot subscribe until the app is installed. */
  "needs_install",
] as const;

export type PushPromptValue = (typeof PUSH_PROMPT_VALUES)[number];

/** Every (event, value) pair the API will store. Anything else is a 400. */
export const FUNNEL_EVENTS: Readonly<Record<string, readonly string[]>> = {
  [ONBOARDING_STEP_EVENT]: ONBOARDING_STEP_IDS,
  [PUSH_PROMPT_EVENT]: PUSH_PROMPT_VALUES,
};

export function isKnownFunnelEvent(event: string, value: string): boolean {
  return FUNNEL_EVENTS[event]?.includes(value) ?? false;
}
