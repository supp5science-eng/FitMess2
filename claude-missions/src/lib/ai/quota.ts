import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { toBelgradeCalendarDay } from "@/lib/dates";
import {
  isIosNativeShellUserAgent,
  isNativeAppUserAgent,
} from "@/lib/device/native";
import { FREE_DAILY_AI } from "@/lib/ai/limits";
import { AI_LIMIT_EVENT, type AiLimitValue } from "@/lib/funnel/events";
import type { Database } from "@/lib/types/db";

/**
 * The free daily AI allowance, and the one place that decides what happens
 * when it runs out.
 *
 * Every AI way into the log — photo, voice, snack, label, Prizma, new product
 * — passes through `chargeAiEstimate` before it reaches a paid model. There is
 * no second door: `src/lib/ai/gemini.ts` is deliberately NOT where this lives,
 * because it is an HTTP client with no idea who the caller is, and because a
 * single user action can make two model calls (Prizma analyses, then
 * finalises). Charging per HTTP request would bill one meal twice and make
 * "five a day" a lie. The unit of charge is a user action.
 */

export { FREE_DAILY_AI } from "@/lib/ai/limits";

/**
 * ⚠️ ENFORCEMENT IS OFF, AND THAT IS THE DECISION, NOT AN UNFINISHED EDGE.
 *
 * Turning a limit on before there is anything to buy is a wall with no door in
 * it. The app's measured problem is that people stop coming back after the
 * plan (see the funnel work behind `0028_funnel_events.sql`) — cutting off the
 * sixth meal photo of someone who was still bothering to log makes exactly
 * that worse, and earns nothing, because the only thing on the other side of
 * the wall today is an apology.
 *
 * What runs today is the counting, which is where the value is: `ai_usage`
 * learns how much demand there really is, and `ai_limit_hit` learns which
 * SURFACE that demand sits on — the number that decides whether web payment is
 * ever worth its risk (see `@/lib/funnel/events`).
 *
 * FLIP THIS TO `true` the day a purchase exists, in the same change that ships
 * the paywall — never before, and never on its own.
 */
export const ENFORCE_AI_LIMIT = false;

/** What the caller should tell the user when the allowance is spent. */
export const AI_LIMIT_ERROR_SR =
  `Iskoristio si ${FREE_DAILY_AI} od ${FREE_DAILY_AI} AI procena za danas. ` +
  `Sutra ujutru imaš ponovo ${FREE_DAILY_AI}. ` +
  `Do tada možeš da unosiš hranu pretragom — to nema ograničenje.`;

export type AiQuotaVerdict =
  | {
      ok: true;
      /** How many estimates this user has spent today, after this one. */
      used: number;
      /** Estimates left, or `null` for an entitled user (no ceiling). */
      remaining: number | null;
      entitled: boolean;
    }
  | { ok: false; error_sr: string; used: number };

/**
 * Which surface the caller is standing on, for the funnel row.
 *
 * Reads the User-Agent rather than asking Capacitor, for the same reason
 * `@/lib/device/native` does: this runs server-side, before any of our
 * JavaScript, and the UA marker is the only signal that exists that early.
 */
async function currentSurface(): Promise<AiLimitValue> {
  try {
    const ua = (await headers()).get("user-agent");
    if (!isNativeAppUserAgent(ua)) return "browser";
    return isIosNativeShellUserAgent(ua) ? "native_ios" : "native_android";
  } catch {
    // `headers()` throws outside a request scope (a unit test calling an
    // action directly). "browser" is the answer that invents the least.
    return "browser";
  }
}

/**
 * Charges one AI estimate to the signed-in user and says whether to proceed.
 *
 * Call this AFTER the auth gate and BEFORE the model, in every action that
 * spends an AI call on the user's behalf. The shape matches what those actions
 * already return (`{ ok: false, error_sr }`), so a refusal travels to the user
 * through the error channel their flow already renders — no new UI, and no
 * screen that can be reached in a state nobody designed.
 *
 * FAILS OPEN. If the RPC errors — a dropped connection, a migration that has
 * not been applied yet — the user gets their estimate and the failure goes to
 * the log. A counter is a business nicety; refusing to analyse someone's lunch
 * because our bookkeeping hiccuped is a broken app. The cost of failing open
 * is bounded by Gemini's own quota, which is the ceiling that has always been
 * there.
 */
export async function chargeAiEstimate(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AiQuotaVerdict> {
  const day = toBelgradeCalendarDay();

  const { data, error } = await supabase.rpc("consume_ai_quota", { p_day: day });

  if (error || !data || data.length === 0) {
    console.error("[quota] consume_ai_quota failed, failing open:", error);
    return { ok: true, used: 0, remaining: null, entitled: false };
  }

  const { used, entitled } = data[0];
  const verdict = decideQuota({ used, entitled, enforce: ENFORCE_AI_LIMIT });

  // Record WHERE the wall was hit BEFORE acting on the verdict, so the
  // measurement survives whether enforcement is on or off -- that ordering is
  // the whole reason this phase ships ahead of the paywall.
  if (!entitled && used > FREE_DAILY_AI) {
    await recordLimitHit(supabase, userId);
  }

  return verdict;
}

/**
 * The whole decision, as a pure function: given where the user stands, what
 * happens next.
 *
 * Split out from the database call on purpose. Everything interesting about
 * this feature is in these five lines — the boundary condition at exactly the
 * allowance, an entitled user having no ceiling, and enforcement being a
 * switch rather than a rewrite — and none of it should need a fake Supabase
 * client to test.
 */
export function decideQuota({
  used,
  entitled,
  enforce,
}: {
  used: number;
  entitled: boolean;
  enforce: boolean;
}): AiQuotaVerdict {
  if (entitled) return { ok: true, used, remaining: null, entitled: true };

  // `<=`, not `<`: `used` is the count AFTER this estimate was charged, so the
  // fifth estimate of the day arrives here as 5 and must be allowed. Off by one
  // in the other direction and the advertised five silently becomes four.
  if (used <= FREE_DAILY_AI) {
    return { ok: true, used, remaining: FREE_DAILY_AI - used, entitled: false };
  }

  if (!enforce) return { ok: true, used, remaining: 0, entitled: false };

  return { ok: false, error_sr: AI_LIMIT_ERROR_SR, used };
}

/**
 * Notes that this user hit the wall, and on which surface.
 *
 * `on conflict do nothing` at the table level makes this idempotent, so the
 * row records "reached at least once" no matter how many times someone taps.
 * Best-effort by design: a failed measurement must never turn into a failed
 * meal, so the error is logged and swallowed.
 */
async function recordLimitHit(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  try {
    const surface = await currentSurface();
    const { error } = await supabase
      .from("funnel_events")
      .upsert(
        { user_id: userId, event: AI_LIMIT_EVENT, value: surface },
        { onConflict: "user_id,event,value", ignoreDuplicates: true }
      );
    if (error) console.error("[quota] ai_limit_hit not recorded:", error);
  } catch (err) {
    console.error("[quota] ai_limit_hit threw:", err);
  }
}
