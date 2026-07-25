import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import { RemindersForm } from "./reminders-form";

// `/profil/podsetnici` — the Podsetnici screen (2026-07-25).
//
// v1 ships exactly one reminder, on the product owner's call: **"danas nisi
// ništa uneo"**, sent at a chosen time and only when the day really is empty.
// One switch, one time, one "does it even work?" button — everything else this
// feature could grow into is a column in `reminder_settings`, not a rewrite.
//
// Server Component: reads the saved row (auth is already guaranteed by
// middleware) and hands it to the client form, which owns the parts only the
// browser knows — permission state, whether this window can subscribe at all,
// and the actual Push subscription.

export default async function PodsetniciPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  let enabled = false;
  let time = "12:00";

  if (userId) {
    const { data } = await supabase
      .from("reminder_settings")
      .select("no_log_enabled, no_log_time")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      enabled = data.no_log_enabled;
      // Postgres hands back "HH:MM:SS"; the picker speaks "HH:MM".
      time = data.no_log_time.slice(0, 5);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        Podešavanja
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Podsetnici
        </h1>
        <p className="text-sm text-muted-foreground">
          Jedan podsetnik, i to samo kad ima smisla: ako do izabranog vremena
          nisi uneo nijedan obrok, javimo ti se. Ako si već beležio — ćutimo.
        </p>
      </div>

      <RemindersForm
        initialEnabled={enabled}
        initialTime={time}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
    </main>
  );
}
