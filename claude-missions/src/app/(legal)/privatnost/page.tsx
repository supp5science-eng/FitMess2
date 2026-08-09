import type { Metadata } from "next";

import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { getT } from "@/lib/i18n/server";
import { PRIVACY_PATH } from "@/lib/legal/paths";

/**
 * `/privatnost` — the public privacy policy.
 *
 * This is the URL that goes into App Store Connect and Play Console. It must
 * open for a stranger on a desktop, with no account and no app: both gates it
 * would otherwise hit are lifted for it in `src/lib/legal/paths.ts`.
 */
export const metadata: Metadata = {
  title: "Politika privatnosti",
  description:
    "Šta FitMess prikuplja, zašto, ko još to vidi, koliko dugo se čuva i kako da obrišeš svoje podatke.",
  alternates: { canonical: PRIVACY_PATH },
  robots: { index: true, follow: true },
};

export default async function PrivatnostPage() {
  const { locale, t } = await getT();
  return <PrivacyPolicy locale={locale} t={t} />;
}
