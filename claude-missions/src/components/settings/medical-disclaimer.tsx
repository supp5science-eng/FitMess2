import Link from "next/link";
import { Info } from "lucide-react";

import { getT } from "@/lib/i18n/server";

/**
 * The "FitMess is not medical advice" note that closes the Settings screen.
 *
 * Deliberately the LAST thing on `/profil` and deliberately quiet: it is a
 * standing disclaimer, not a warning that needs to interrupt anyone. Every
 * screen the user looks at daily stays free of it; the full text lives in
 * `/profil/uslovi`, which this links to.
 *
 * Plain server component (no client JS) -- copy comes from the shared
 * dictionary so it exists in both locales.
 */
export async function MedicalDisclaimer() {
  const { t } = await getT();

  return (
    <section className="flex flex-col items-center gap-1.5 px-4 pb-2 pt-1 text-center">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden={true} />
        {t("settings.disclaimer.title")}
      </p>
      <p className="max-w-[46ch] text-xs leading-relaxed text-muted-foreground/75">
        {t("settings.disclaimer.body")}
      </p>
      <Link
        href="/profil/uslovi"
        className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {t("settings.disclaimer.more")}
      </Link>
    </section>
  );
}
