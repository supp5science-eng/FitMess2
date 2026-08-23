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

/**
 * The gap between "got a plan" and "wrote down a meal".
 *
 * This is where the users actually go (measured 2026-08-03, after stripping
 * the `@example.com` integration-test fixtures that had been inflating every
 * earlier count): of 14 real accounts, 12 confirmed their email and 9 finished
 * the questionnaire — that part converts fine — but only 2 ever logged a
 * single meal, and NOBODY came back a second day.
 *
 * `logs` already tells us who finished. What it cannot tell us is whether the
 * other seven never opened the "+" menu at all, or opened it, chose a way in,
 * and gave up inside the flow — a camera permission, an AI call, a screen that
 * asks for more than they had. Those two failures have nothing in common and
 * no shared fix, which is why guessing here is expensive.
 */
export const ADD_FLOW_EVENT = "add_flow";

/** `menu_open`, plus `start_<option>` for each way into logging. */
export const ADD_FLOW_VALUES = [
  "menu_open",
  "start_najtacnije",
  "start_obrok",
  "start_gric",
  "start_deklaracija",
  "start_trening",
] as const;

export type AddFlowValue = (typeof ADD_FLOW_VALUES)[number];

/**
 * 0032 (naplata): the user ran out of the free daily AI allowance, and WHERE
 * they were standing when it happened.
 *
 * This is the one measurement that decides whether web payment ever gets
 * built. Selling on the site is not forbidden — Apple's 3.1.3(b) allows an app
 * to honour a subscription bought elsewhere — but FitMess ships as a REMOTE
 * Capacitor shell, so the site is literally the store app's content and a
 * checkout page is one bad render away from a guideline violation. That risk
 * is only worth taking if would-be payers who never install either store app
 * actually exist. Nobody can answer that from intuition; this answers it from
 * traffic.
 *
 * The value is the SURFACE, not a count: `ai_usage.count` already carries
 * magnitude, and `funnel_events`' primary key deliberately stores "reached at
 * least once". Together they say how many people hit the wall, how hard, and
 * from where.
 */
export const AI_LIMIT_EVENT = "ai_limit_hit";

/** Which surface the user was on when the allowance ran out. */
export const AI_LIMIT_VALUES = [
  "native_ios",
  "native_android",
  "browser",
] as const;

export type AiLimitValue = (typeof AI_LIMIT_VALUES)[number];

/** Every (event, value) pair the API will store. Anything else is a 400. */
export const FUNNEL_EVENTS: Readonly<Record<string, readonly string[]>> = {
  [ONBOARDING_STEP_EVENT]: ONBOARDING_STEP_IDS,
  [PUSH_PROMPT_EVENT]: PUSH_PROMPT_VALUES,
  [ADD_FLOW_EVENT]: ADD_FLOW_VALUES,
  [AI_LIMIT_EVENT]: AI_LIMIT_VALUES,
};

export function isKnownFunnelEvent(event: string, value: string): boolean {
  return FUNNEL_EVENTS[event]?.includes(value) ?? false;
}
