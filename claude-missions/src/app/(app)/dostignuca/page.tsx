import Link from "next/link";

import { AchievementsScreen } from "@/components/achievements/achievements-screen";
import {
  achievementsSummary,
  evaluateAchievements,
  groupByCategory,
} from "@/lib/achievements/achievements";
import { getUserStats } from "@/lib/achievements/read-stats";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// `/dostignuca` — the achievements / badges screen, reached by tapping the
// streak card on `/danas` (the product owner's single chosen entry point).
//
// Server Component: reads the user's aggregate stats on the session-scoped RLS
// client (`getUserStats`, which never throws — each piece degrades to 0), then
// derives every badge's earned/locked state with pure functions
// (`evaluateAchievements` / `groupByCategory`). Same defensive "never a
// blank/broken screen" posture as `/danas` and `/analitika`: an expired session
// gets its own calm Serbian state.
export default async function DostignucaPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    const { t } = await getT();
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p role="alert" className="text-sm text-destructive">
          {t("media.dostignuca.sessionExpired")}
        </p>
        <Link
          href="/prijava"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {t("media.dostignuca.login")}
        </Link>
      </main>
    );
  }

  const stats = await getUserStats(supabase, userId);
  const achievements = evaluateAchievements(stats);
  const { earned, total } = achievementsSummary(achievements);

  return (
    <AchievementsScreen
      currentStreak={stats.currentStreak}
      bestStreak={stats.bestStreak}
      earned={earned}
      total={total}
      groups={groupByCategory(achievements)}
    />
  );
}
