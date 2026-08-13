import type { Metadata } from "next";

import { TermsOfUse } from "@/components/legal/terms-of-use";
import { getT } from "@/lib/i18n/server";
import { legalAlternates, TERMS_PATH, TERMS_PATH_EN } from "@/lib/legal/paths";

/** `/uslovi` — the public terms of use, linked from both store listings and
 * from the app's own settings. */
export const metadata: Metadata = {
  title: "Uslovi korišćenja",
  description:
    "Uslovi korišćenja FitMess aplikacije: šta aplikacija jeste, šta nije, i šta se očekuje od tebe.",
  alternates: legalAlternates(TERMS_PATH, TERMS_PATH_EN),
  robots: { index: true, follow: true },
};

export default async function UsloviPage() {
  const { locale, t } = await getT();
  return <TermsOfUse locale={locale} t={t} />;
}
