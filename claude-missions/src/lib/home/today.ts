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

/** Attempts (1 initial + retries) for the cold-start-resilient read below. */
const MAX_READ_ATTEMPTS = 3;
/** Backoff before the Nth retry (index 0 = before the 1st retry). */
const RETRY_BACKOFF_MS = [150, 400];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * F027 read with cold-start resilience. On a PWA cold launch (the app resumed
 * after a pause), the FIRST server-side request often runs on a cold Vercel
 * function against a cold Supabase connection, so this read can fail
 * transiently -- the user saw a full "Nismo uspeli da učitamo tvoj dan" screen
 * and a manual "Pokušaj ponovo" (a fresh, now-warm request) always fixed it.
 * Retrying the read a couple of times with a short backoff turns that manual
 * retry into an automatic one, so the error screen effectively never shows for
 * a transient failure. A genuinely persistent error still surfaces after the
 * attempts are exhausted (just delayed by ~0.5s), and empty results are NOT an
 * error so they never trigger a retry.
 */
export async function getTodayData(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DayRange = getTodayRange()
): Promise<TodayDataResult> {
  let last: TodayDataResult = { data: null, error: { message: "unread" } };
  for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFF_MS[attempt - 1] ?? 400);
    }
    last = await readTodayDataOnce(supabase, userId, range);
    if (!last.error) return last;
    console.warn(
      `[F027 getTodayData] read attempt ${attempt + 1}/${MAX_READ_ATTEMPTS} failed:`,
      last.error.message
    );
  }
  return last;
}

async function readTodayDataOnce(
  supabase: SupabaseClient<Database>,
  userId: string,
  range: DayRange
): Promise<TodayDataResult> {
  const [targetResult, logsResult] = await Promise.all([
    supabase
      .from("targets")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("logs")
      .select("*")
      .eq("user_id", userId)
      .gte("logged_at", range.startIso)
      .lt("logged_at", range.endIsoExclusive)
      .order("logged_at", { ascending: false }),
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
      .in("id", foodIds);
    if (foodsResult.error) {
      return { data: null, error: { message: foodsResult.error.message } };
    }
    foods = foodsResult.data ?? [];
  }

  return {
    data: {
      target: targetResult.data ?? null,
      logs: attachFoodToLogs(logs, foods),
    },
    error: null,
  };
}
