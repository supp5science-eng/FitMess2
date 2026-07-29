import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getT } from "@/lib/i18n/server";

// Placeholder Terms of Use page linked from Podešavanja. Honest "in
// preparation" stub -- final, legally-reviewed terms are pending. Wired now so
// the settings link is not a dead 404.
export default async function UsloviPage() {
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
        {t("settings.terms")}
      </h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t("profil.terms.p1")}</p>
        <p>{t("profil.terms.p2")}</p>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-foreground">
          {t("profil.terms.p3")}
        </p>
      </div>
    </main>
  );
}
