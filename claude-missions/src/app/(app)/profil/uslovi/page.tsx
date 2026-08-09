import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { TermsOfUse } from "@/components/legal/terms-of-use";
import { getT } from "@/lib/i18n/server";

/**
 * The terms of use inside the app, reached from Podešavanja and from the
 * medical-disclaimer footer.
 *
 * Same component as the public `/uslovi` route; see the note in the privacy
 * page next door for why it does not link out to it.
 */
export default async function UsloviPage() {
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
      <TermsOfUse locale={locale} t={t} />
    </main>
  );
}
