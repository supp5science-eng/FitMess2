/**
 * Client-side persistence for onboarding answers collected BEFORE the user
 * has an account.
 *
 * The onboarding questionnaire now runs pre-auth (the public `/upitnik`
 * route): a brand-new visitor answers every question and sees their computed
 * plan without signing in. The actual write to Supabase still happens
 * post-auth (RLS needs `auth.uid()`), so the answers have to survive the trip
 * through registration + email verification. We stash them in `localStorage`
 * under a single key and pick them back up on `/onboarding` once a session
 * exists (see `components/onboarding/onboarding-flow.tsx`).
 *
 * Deliberately tiny and framework-free (no React, no Supabase): just typed,
 * SSR-safe get/set/clear around one JSON blob. Every read tolerates malformed
 * / partial data by returning `null` rather than throwing — a corrupted blob
 * should send the user back through the questionnaire, never crash the app.
 */

import type { OnboardingData } from "@/lib/onboarding/types";
import { EMPTY_ONBOARDING_DATA } from "@/lib/onboarding/types";
import {
  isOnboardingDataComplete,
  type CompleteOnboardingData,
} from "@/lib/onboarding/summary";

/** The single `localStorage` key the pre-auth answers live under. */
export const PENDING_ONBOARDING_KEY = "fm_onboarding";

/** All keys we accept off a stored blob — mirrors `OnboardingData`. */
const ONBOARDING_KEYS = Object.keys(EMPTY_ONBOARDING_DATA) as Array<
  keyof OnboardingData
>;

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Persist the questionnaire answers so they survive the auth round-trip.
 * A no-op (never throws) when storage is unavailable or write-blocked
 * (private mode, quota) — a failed save just means the post-auth
 * `/onboarding` falls back to running the questionnaire again.
 */
export function savePendingOnboarding(data: OnboardingData): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(data));
  } catch {
    // Ignore: storage full / blocked. The flow degrades gracefully.
  }
}

/**
 * Read back the pre-auth answers, or `null` if none are stored / the blob is
 * malformed. Only the recognised `OnboardingData` fields are copied off the
 * parsed object, so extra/renamed keys can never leak through.
 */
export function readPendingOnboarding(): OnboardingData | null {
  if (!hasStorage()) return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PENDING_ONBOARDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const source = parsed as Record<string, unknown>;
  const result: OnboardingData = { ...EMPTY_ONBOARDING_DATA };
  for (const key of ONBOARDING_KEYS) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number") {
      // OnboardingData fields are all `string | number | null`; a stored
      // value of the wrong primitive type is dropped to its `null` default.
      (result[key] as string | number | null) = value;
    }
  }
  return result;
}

/**
 * Convenience for the post-auth hand-off: returns the stored answers only if
 * they form a complete plan-able value, otherwise `null` (missing answers ->
 * fall back to the questionnaire rather than persisting a half-filled plan).
 */
export function readCompletePendingOnboarding(): CompleteOnboardingData | null {
  const data = readPendingOnboarding();
  if (data && isOnboardingDataComplete(data)) return data;
  return null;
}

/** Drop the stored answers once they've been written to the account. */
export function clearPendingOnboarding(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(PENDING_ONBOARDING_KEY);
  } catch {
    // Ignore.
  }
}
