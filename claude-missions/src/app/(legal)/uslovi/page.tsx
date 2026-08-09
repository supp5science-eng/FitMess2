import type { Metadata } from "next";

import { TermsOfUse } from "@/components/legal/terms-of-use";
import { getT } from "@/lib/i18n/server";
import { TERMS_PATH } from "@/lib/legal/paths";

/** `/uslovi` — the public terms of use, linked from both store listings and
 * from the app's own settings. */
export const metadata: Metadata = {
  title: "Uslovi korišćenja",
  description:
    "Uslovi korišćenja FitMess aplikacije: šta aplikacija jeste, šta nije, i šta se očekuje od tebe.",
  alternates: { canonical: TERMS_PATH },
  robots: { index: true, follow: true },
};

export default async function UsloviPage() {
  const { locale, t } = await getT();
  return <TermsOfUse locale={locale} t={t} />;
}
