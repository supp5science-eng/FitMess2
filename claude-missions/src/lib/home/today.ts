import type { SupabaseClient } from "@supabase/supabase-js";

import { attachFoodToLogs, type LogWithFood } from "@/lib/home/attach-food";
import { getTodayRange, type DayRange } from "@/lib/home/today-range";
import type { Database, Target } from "@/lib/types/db";

/**
 * F027 / AS-047, AS-048, AS-049: the home screen's server-side data read.
 * Two round trips + an `IN (...)` foods lookup (same shape as
 * `src/lib/food/recents.ts`'s `getRecentFoods`) rather than an embedded
 * select, plus a third read for the user's newest target row.
 *
 * `supabase` MUST be the CALLER's session-bound (RLS) client -- `logs_
 * select_own`/`targets_select_own` RLS (see
 * `supabase/migrations/0001_profiles.sql`, `0004_foods_logs.sql`) is what
 * actually enforces "a user only ever sees their OWN targets/logs," not
 * this function re-implementing that check. `foods` is a shared catalog
 * (`foods_select_all_authenticated`), safe to read regardless of who
 * submitted a given row.
 *
 * "Newest target wins": `order("effective_from", { ascending: false }).
 * limit(1)` -- matches the documented hot-query path comment on
 * `targets_user_id_effective_from_idx`. A user who has not yet completed
 * onboarding (no target row at all -- should not normally reach `/danas` at
 * all, per `src/middleware.ts`'s onboarding gate, but defensively handled
 * here too) resolves to `target: null`; the caller (`/danas`'s page) shows
 * an empty/no-target state rather than crashing.
 */
export interface TodayData {
  target: Target | null;
  logs: LogWithFood[];
}

export interface TodayDataResult {
  data: TodayData | null;
  error: { message: string } | null;
}

/**
 * Total wall-clock budget for the cold-start retry loop. The failing case is a
 * COLD connection (Vercel serverless -> Supabase pooler) that fast-fails at the
 * network layer for the first ~second or two, then succeeds once warm -- which
 * is exactly why a manual "Pokušaj ponovo" a couple seconds later always works.
 * The automatic retry has to span that same warm-up window to replace the
 * manual one, so ~4s is deliberately longer than the old ~0.55s (which was too
 * short to outlast the cold window). This whole time is spent under
 * `danas/loading.tsx`'s skeleton, so it reads as a slightly longer load, never
 * a blank/error screen.
 */
const READ_DEADLINE_MS = 4000;
/**
 * Per-attempt timeout. A cold connection can also HANG (rather than fast-fail);
 * without a bound a single hung attempt would eat the whole function budget and
 * never leave room to retry. Aborting after this long turns a hang into a
 * fast-failed attempt that the loop can retry within the deadline.
 */
const PER_ATTEMPT_TIMEOUT_MS = 1500;
/** Backoff before the Nth retry (index 0 = before the 1st retry). */
const RETRY_BACKOFF_MS = [150, 350, 700, 1000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * F027 read with cold-start resilience. On a PWA cold launch (the app resumed
 * after a pause), the FIRST server-side request often runs on a cold Vercel
 * function against a cold Supabase connection, so this read can fail
 * transiently -- the user saw a full "Nismo uspeli da učitamo tvoj dan" screen
 * and a manual "Pokušaj ponovo" (a fresh, now-warm request) always fixed it.
 *
 * We retry the read until it succeeds or a total time budget
 * (`READ_DEADLINE_MS`) elapses, with progressive backoff and a per-attempt
 * timeout, so the automatic retry outlasts the connection warm-up window that
 * the manual retry was implicitly waiting out. A genuinely persistent error
 * still surfaces once the budget is exhausted, and empty results are NOT an
 * error so they never trigger a retry.
 */
export async function getTodayData(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DayRange = getTodayRange()
): Promise<TodayDataResult> {
  const deadline = Date.now() + READ_DEADLINE_MS;
  let last: TodayDataResult = { data: null, error: { message: "unread" } };
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 1000);
      if (Date.now() >= deadline) break;
    }
    last = await readTodayDataOnce(supabase, userId, range);
    if (!last.error) return last;
    console.warn(
      `[F027 getTodayData] read attempt ${attempt + 1} failed:`,
      last.error.message
    );
    if (Date.now() >= deadline) break;
  }
  return last;
}

async function readTodayDataOnce(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DayRange
): Promise<TodayDataResult> {
  // Bound every attempt: a hung cold connection is aborted so the loop keeps
  // its time budget to retry, instead of one attempt swallowing all of it.
  const signal = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
  try {
    const [targetResult, logsResult] = await Promise.all([
      supabase
        .from("targets")
        .select("*")
        .eq("user_id", userId)
        .order("effective_from", { ascending: false })
        .limit(1)
        .abortSignal(signal)
        .maybeSingle(),
      supabase
        .from("logs")
        .select("*")
        .eq("user_id", userId)
        .gte("logged_at", range.startIso)
        .lt("logged_at", range.endIsoExclusive)
        .order("logged_at", { ascending: false })
        .abortSignal(signal),
    ]);

    if (targetResult.error) {
      return { data: null, error: { message: targetResult.error.message } };
    }
    if (logsResult.error) {
      return { data: null, error: { message: logsResult.error.message } };
    }

    const logs = logsResult.data ?? [];
    const foodIds = Array.from(
      new Set(
        logs
          .map((log) => log.food_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let foods: Database["public"]["Tables"]["foods"]["Row"][] = [];
    if (foodIds.length > 0) {
      const foodsResult = await supabase
        .from("foods")
        .select("*")
        .in("id", foodIds)
        .abortSignal(signal);
      if (foodsResult.error) {
        return { data: null, error: { message: foodsResult.error.message } };
      }
      foods = foodsResult.data ?? [];
    }

    // Which of today's logs have a stored meal photo ("Slikaj obrok"). Read
    // only the ids (never the base64 bytes -- those are served on demand from
    // `/api/obrok-slika/[logId]`, keeping this page light). BEST-EFFORT: the
    // photo is a non-critical enhancement, so any failure here (including the
    // `meal_photos` table not existing yet) degrades to "no photos" and never
    // fails the core day read.
    let photoLogIds = new Set<string>();
    const logIds = logs.map((log) => log.id);
    if (logIds.length > 0) {
      try {
        const photosResult = await supabase
          .from("meal_photos")
          .select("log_id")
          .in("log_id", logIds)
          .abortSignal(signal);
        if (!photosResult.error && photosResult.data) {
          photoLogIds = new Set(photosResult.data.map((row) => row.log_id));
        }
      } catch {
        // ignore -- photos are optional, keep the day read healthy
      }
    }

    return {
      data: {
        target: targetResult.data ?? null,
        logs: attachFoodToLogs(logs, foods, photoLogIds),
      },
      error: null,
    };
  } catch (err) {
    // A thrown network/abort error (rather than a returned `.error`) must not
    // escape the retry loop -- convert it so the caller can retry it.
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}
