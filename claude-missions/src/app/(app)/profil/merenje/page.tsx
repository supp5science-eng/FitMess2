import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_WEIGH_IN_DAY,
  DEFAULT_WEIGH_IN_TIME,
  normalizeWeighInDay,
} from "@/lib/weight/weigh-in-day";

import { WeighInDayForm } from "./weigh-in-day-form";

/**
 * `/profil/merenje` -- "Dan merenja".
 *
 * The only setting the weekly weigh-in has, and it exists because the choice
 * genuinely belongs to the user: someone who works nights, or whose Sunday is
 * the one day they eat out, has a better idea than a default does. What is NOT
 * negotiable, and what the copy says plainly, is that it has to be the same day
 * every week -- body weight follows a weekly rhythm, so a Sunday reading against
 * a Wednesday one manufactures change that never happened.
 */
export default async function DanMerenjaPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const userId = await getCurrentUserId(supabase);

  let weighInDay = DEFAULT_WEIGH_IN_DAY;
  let weighInTime = DEFAULT_WEIGH_IN_TIME;
  let pushEnabled = true;

  if (userId) {
    // Isolated read, same reasoning as everywhere else these 0024 columns are
    // touched: an environment without the migration falls back to the defaults
    // rather than rendering an error page for a settings screen.
    const { data, error } = await supabase
      .from("reminder_settings")
      .select("weighin_day, weighin_time, weighin_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[merenje] settings read failed:", error.message);
    } else if (data) {
      weighInDay = normalizeWeighInDay(data.weighin_day ?? null);
      // Postgres hands back `"09:00:00"`; the picker speaks `"09:00"`.
      weighInTime = (data.weighin_time ?? DEFAULT_WEIGH_IN_TIME).slice(0, 5);
      pushEnabled = data.weighin_enabled ?? true;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("settings.title")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("merenje.settings.title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("merenje.settings.subtitle")}
        </p>
      </div>

      <WeighInDayForm
        initialDay={weighInDay}
        initialTime={weighInTime}
        initialPushEnabled={pushEnabled}
      />
    </main>
  );
}
