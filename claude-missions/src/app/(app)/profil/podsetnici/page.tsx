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

import type { ReminderPreferences } from "./actions";
import { RemindersForm } from "./reminders-form";

// `/profil/podsetnici` — the Podsetnici screen (2026-07-25, reworked 2026-08-01).
//
// v1 shipped one conditional reminder ("danas nisi ništa uneo") that only fired
// on a day with ZERO logs — the people actually using the app never saw it. v2
// over-corrected into two DAILY reminders that arrived regardless, which is the
// version people mute. v3 is four switches, each conditional on something real:
// the missing meal (timed by the user's own rhythm), the evening close-out (only
// when it has news), the weekly weigh-in, and the earned "pun dan" trophy — with
// a hard ceiling of two pushes a day across all of them.
//
// Server Component: reads the saved row (auth is already guaranteed by
// middleware) and hands it to the client form, which owns the parts only the
// browser knows — permission state, whether this window can subscribe at all,
// and the actual Push subscription.

/** What a user who has never touched this screen gets. Both reminders default
 * ON: someone opening the screen came here to be reminded, and the switches are
 * right there to say otherwise. */
const DEFAULTS: ReminderPreferences = {
  mealEnabled: true,
  eveningEnabled: true,
  eveningTime: "20:00",
  awardEnabled: true,
};

export default async function PodsetniciPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const userId = await getCurrentUserId(supabase);

  let preferences = DEFAULTS;
  let weighIn = {
    enabled: true,
    day: DEFAULT_WEIGH_IN_DAY,
    time: DEFAULT_WEIGH_IN_TIME,
  };

  if (userId) {
    const { data } = await supabase
      .from("reminder_settings")
      .select("meal_enabled, evening_enabled, evening_time, award_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      preferences = {
        mealEnabled: data.meal_enabled ?? true,
        eveningEnabled: data.evening_enabled,
        // Postgres hands back "HH:MM:SS"; the picker speaks "HH:MM".
        eveningTime: data.evening_time.slice(0, 5),
        awardEnabled: data.award_enabled,
      };
    }

    // The 0024 columns in their own read, the same way `/profil/merenje` does
    // it: a deployment without that migration must lose the weigh-in row, not
    // the whole screen.
    const { data: weighInRow, error: weighInError } = await supabase
      .from("reminder_settings")
      .select("weighin_enabled, weighin_day, weighin_time")
      .eq("user_id", userId)
      .maybeSingle();

    if (weighInError) {
      console.error("[podsetnici] weigh-in read failed:", weighInError.message);
    } else if (weighInRow) {
      weighIn = {
        enabled: weighInRow.weighin_enabled ?? true,
        day: normalizeWeighInDay(weighInRow.weighin_day ?? null),
        time: (weighInRow.weighin_time ?? DEFAULT_WEIGH_IN_TIME).slice(0, 5),
      };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("settings.title")}
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("settings.reminders")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("profil.reminders.subtitle")}
        </p>
      </div>

      <RemindersForm
        initial={preferences}
        weighIn={weighIn}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
    </main>
  );
}
