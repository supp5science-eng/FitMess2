import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";

import { getT } from "@/lib/i18n/server";

// Terms of Use, linked from Podešavanja. The medical disclaimer is the lead
// section on purpose -- it is the part that actually matters to a user of a
// calorie tracker, and the settings footer (`MedicalDisclaimer`) links here
// for it. The remaining boilerplate (company details, payment, jurisdiction)
// is still pending a real legal review, which the closing note says plainly
// rather than pretending otherwise.
export default async function UsloviPage() {
  const { t } = await getT();

  const doctorItems = [
    t("profil.terms.doctor.li1"),
    t("profil.terms.doctor.li2"),
    t("profil.terms.doctor.li3"),
    t("profil.terms.doctor.li4"),
    t("profil.terms.doctor.li5"),
    t("profil.terms.doctor.li6"),
  ];

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

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted-foreground">
        <p>{t("profil.terms.intro")}</p>

        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ShieldAlert className="size-[18px] shrink-0" aria-hidden={true} />
            {t("profil.terms.medical.h")}
          </h2>
          <p className="text-foreground/90">{t("profil.terms.medical.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("profil.terms.doctor.h")}
          </h2>
          <p>{t("profil.terms.doctor.lead")}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {doctorItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-1">{t("profil.terms.doctor.note")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("profil.terms.accuracy.h")}
          </h2>
          <p>{t("profil.terms.accuracy.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("profil.terms.responsibility.h")}
          </h2>
          <p>{t("profil.terms.responsibility.body")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("profil.terms.liability.h")}
          </h2>
          <p>{t("profil.terms.liability.body")}</p>
        </section>

        <p className="rounded-xl border border-border bg-card px-4 py-3 text-foreground">
          {t("profil.terms.pending")}
        </p>
      </div>
    </main>
  );
}
