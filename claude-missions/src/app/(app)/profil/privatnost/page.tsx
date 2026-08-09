import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { getT } from "@/lib/i18n/server";

/**
 * The privacy policy inside the app, reached from Podešavanja.
 *
 * Same component as the public `/privatnost` route — only the frame differs
 * (a way back to Settings instead of the public header/footer). Two copies of
 * a privacy policy is how an app ends up promising one thing to its users and
 * another to a store reviewer.
 *
 * It deliberately does NOT link out to the public route: those pages render
 * full-bleed with no navigation, so a user who followed such a link inside the
 * installed app would have no way back — see the "no exits" rule that governs
 * every in-app link.
 */
export default async function PrivatnostPage() {
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
      <PrivacyPolicy locale={locale} t={t} />
    </main>
  );
}
