import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getT } from "@/lib/i18n/server";

// Placeholder Privacy Policy page linked from Podešavanja. Deliberately an
// honest "in preparation" stub -- the real, legally-reviewed policy text is
// pending (it must be written/approved by the operator, not fabricated here).
// Wired now so the settings link is not a dead 404 and the final copy can drop
// straight into this route later.
export default async function PrivatnostPage() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("settings.title")}
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t("settings.privacy")}
      </h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t("profil.privacy.p1")}</p>
        <p>{t("profil.privacy.p2")}</p>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-foreground">
          {t("profil.privacy.p3")}
        </p>
        <p>{t("profil.privacy.notMedical")}</p>
        <Link
          href="/profil/uslovi"
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t("profil.privacy.termsLink")}
        </Link>
      </div>
    </main>
  );
}
