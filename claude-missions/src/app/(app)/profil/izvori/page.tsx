import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { MedicalSources } from "@/components/legal/medical-sources";
import { getT } from "@/lib/i18n/server";

/**
 * "Odakle brojevi" inside the app, reached from Podešavanja and from the
 * "Odakle ovaj broj?" link next to every computed number.
 *
 * Same component as the public `/izvori` route — only the frame differs (a way
 * back to Settings instead of the public header/footer), exactly as
 * `/profil/privatnost` does it. Two copies of the citations is how the app
 * ends up telling a user one thing and a store reviewer another.
 *
 * It deliberately does NOT link out to the public route: those pages render
 * full-bleed with no navigation, so a user who followed such a link inside the
 * installed app would have no way back — the "no exits" rule.
 */
export default async function ProfilIzvoriPage() {
  const { locale, t } = await getT();

  return (
    <main className="flex w-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-5 pt-8">
        <Link
          href="/profil"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden={true} />
          {t("legal.backToSettings")}
        </Link>
      </div>
      <MedicalSources locale={locale} t={t} />
    </main>
  );
}
