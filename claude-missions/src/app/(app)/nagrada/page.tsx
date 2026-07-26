import { currentStreak, FULL_DAY_AWARD } from "@/lib/awards/streak";
import { getCurrentUserId } from "@/lib/auth/current-user";
import {
  endOfBelgradeDayExclusive,
  startOfBelgradeDay,
  toBelgradeCalendarDay,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import { RewardCelebration } from "./reward-celebration";

// `/nagrada` — what a full day (three logged meals) leaves behind.
//
// Reached two ways: by tapping the "Pun dan! 🏆" push, and from the home
// screen. Both land here, and the screen has to be honest in either case, so it
// has TWO states:
//
//   * earned — the celebration, with the streak counting up
//   * not yet — how many meals are still missing, no confetti
//
// The second state exists because a notification can be tapped hours later, on
// a different day, and because nothing stops a user from navigating here
// directly. A reward screen that celebrates unconditionally would be lying the
// moment it is opened out of order.
//
// Server Component: reads the facts, hands them to the client component that
// owns the animation. The streak is DERIVED from `awards` rows on every read
// (see `src/lib/awards/streak.ts`), never stored, so it cannot go stale.

export default async function NagradaPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  const now = new Date();
  const todayKey = toBelgradeCalendarDay(now);

  if (!userId) {
    // Middleware guarantees a session; this is the defensive branch, and the
    // honest thing to show is the un-earned state rather than a fake trophy.
    return <RewardCelebration earned={false} streak={0} loggedMeals={0} />;
  }

  const [{ data: awardDays }, { count: mealCount }] = await Promise.all([
    supabase
      .from("awards")
      .select("day")
      .eq("user_id", userId)
      .eq("kind", FULL_DAY_AWARD)
      .order("day", { ascending: false })
      .limit(120),
    supabase
      .from("logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("logged_at", startOfBelgradeDay(now).toISOString())
      .lt("logged_at", endOfBelgradeDayExclusive(now).toISOString()),
  ]);

  const streak = currentStreak(
    (awardDays ?? []).map((row) => row.day),
    todayKey
  );

  return (
    <RewardCelebration
      earned={streak.earnedToday}
      streak={streak.days}
      loggedMeals={mealCount ?? 0}
    />
  );
}
