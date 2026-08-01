import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { macroTargets } from "@/lib/budget/engine";
import { toBelgradeCalendarDay } from "@/lib/dates";
import { DAY_ANSWER_COOKIE, parseDayAnswers } from "@/lib/home/day-trust";
import type { Database } from "@/lib/types/db";
import { recordAdjustment } from "@/lib/weight/plan-adjustments";
import { loadWeeklyReview } from "@/lib/weight/weekly-review";

// Nedeljno merenje: `POST /api/plan-korekcija` — the user's answer to a
// suggested plan correction. `{ accepted: true }` writes a new `targets` row;
// `{ accepted: false }` records the refusal, which silences the card for two
// weeks.
//
// The request body carries ONLY that boolean. Every number -- the new daily
// kcal, the measured TDEE, the reason -- is recomputed here from stored data
// via `loadWeeklyReview`, never taken from the client. Two reasons, and the
// second is the important one:
//
//   * a client could otherwise post itself any calorie target it liked, and
//   * a card left open in a background tab since last Sunday would happily
//     apply a suggestion that this week's weigh-in has already made wrong.
//
// If the recomputation no longer produces a suggestion, the answer is a plain
// "that offer is no longer current" rather than a write.
//
// The new target is INSERTED, never an update: `targets` is a history table
// where the newest `effective_from` wins, exactly as `update-profile.ts` and
// onboarding already treat it.

const SESSION_EXPIRED_ERROR_SR =
  "Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.";
const INVALID_REQUEST_ERROR_SR = "Neispravan zahtev.";
const STALE_SUGGESTION_ERROR_SR =
  "Ovaj predlog više nije aktuelan. Osveži stranicu da vidiš novi.";
const SAVE_FAILED_ERROR_SR =
  "Nismo uspeli da sačuvamo odluku. Pokušaj ponovo.";

const bodySchema = z.object({
  accepted: z.boolean({ message: INVALID_REQUEST_ERROR_SR }),
});

export async function POST(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          // No-op: this write never needs to refresh/write the session cookie.
        },
      },
    }
  );

  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return NextResponse.json(
      { ok: false, error_sr: SESSION_EXPIRED_ERROR_SR },
      { status: 401 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error_sr: INVALID_REQUEST_ERROR_SR },
      { status: 400 }
    );
  }

  const { accepted } = parsed.data;
  const dayAnswers = parseDayAnswers(
    request.cookies.get(DAY_ANSWER_COOKIE)?.value ?? null
  );

  const review = await loadWeeklyReview(supabase, userId, { dayAnswers });
  const suggestion = review.trend.suggestion;
  const currentTarget = review.currentTarget;

  // No live suggestion (already answered this week, the trend moved, or the
  // window went stale): nothing to accept and nothing to decline.
  if (!suggestion || !currentTarget || suggestion.deltaKcal === 0) {
    return NextResponse.json(
      { ok: false, error_sr: STALE_SUGGESTION_ERROR_SR },
      { status: 409 }
    );
  }

  const todayKey = toBelgradeCalendarDay(new Date());

  if (accepted) {
    // Macros are recomputed from the CURRENT weight (the weigh-in we just
    // trusted enough to change the plan over), not from the profile row the
    // original plan was written against -- protein and fat are g/kg targets, so
    // a stale weight would quietly under-prescribe both.
    const weightKg =
      review.trend.currentWeightKg ?? currentTarget.goalWeightKg ?? 0;
    const macros = macroTargets(weightKg, suggestion.newDailyKcal);

    const { error: targetError } = await supabase.from("targets").insert({
      user_id: userId,
      daily_kcal: suggestion.newDailyKcal,
      protein_g: macros.proteinG,
      fat_g: macros.fatG,
      carbs_g: macros.carbsG,
      weekly_kcal: suggestion.newDailyKcal * 7,
      goal: currentTarget.goal ?? "maintain",
      goal_weight_kg: currentTarget.goalWeightKg,
      timeframe_weeks: currentTarget.timeframeWeeks,
    });

    if (targetError) {
      console.error("[merenje] targets insert failed:", targetError.message);
      return NextResponse.json(
        { ok: false, error_sr: SAVE_FAILED_ERROR_SR },
        { status: 500 }
      );
    }
  }

  // Written AFTER the target, so a failed plan write can never leave behind a
  // record claiming the user accepted a change that did not happen. The reverse
  // order would also silence the card for two weeks on a decline that failed.
  const { error: recordError } = await recordAdjustment(supabase, userId, {
    day: todayKey,
    oldKcal: currentTarget.dailyKcal,
    newKcal: suggestion.newDailyKcal,
    reason: review.trend.status,
    accepted,
    measuredTdeeKcal: review.trend.measuredTdeeKcal,
  });

  if (recordError) {
    console.error(
      "[merenje] plan_adjustments insert failed:",
      recordError.message
    );
    // The plan change (if any) DID land; failing the whole request now would
    // invite a retry that inserts a second targets row. Report success and
    // accept the missing history row -- the worst case is being asked again.
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        accepted,
        dailyKcal: accepted
          ? suggestion.newDailyKcal
          : currentTarget.dailyKcal,
      },
    },
    { status: 200 }
  );
}
