import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

import { PhoneForm } from "./phone-form";

/**
 * `/profil/telefon` -- "Broj telefona" in Podešavanja.
 *
 * The settings row used to link at `/telefon`, which is the ONBOARDING capture
 * gate: it greets you with "Još samo broj telefona", starts empty even though
 * your number is already on file, has no way back (it lives in the `(auth)`
 * layout, so no bottom nav and no back link), and on save throws you out to
 * `/danas`. From settings that is the wrong page in every respect.
 *
 * This is the edit version: same app shell as the rest of Podešavanja, current
 * number prefilled, back link to the settings list, and it returns there after
 * saving. `/telefon` stays as-is for the Google-OAuth first-run gate.
 */
export default async function TelefonSettingsPage() {
  const supabase = await createClient();
  const { t } = await getT();
  const userId = await getCurrentUserId(supabase);

  let phone: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", userId)
      .maybeSingle();
    phone = data?.phone ?? null;
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
          {t("settings.phone")}
        </h1>
        {phone ? null : (
          <p className="text-sm text-muted-foreground">
            {t("profil.phone.noNumber")}
          </p>
        )}
      </div>

      <PhoneForm phone={phone} />
    </main>
  );
}
