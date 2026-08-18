import type { Metadata } from "next";

import { MedicalSources } from "@/components/legal/medical-sources";
import { getT } from "@/lib/i18n/server";
import { legalAlternates, SOURCES_PATH, SOURCES_PATH_EN } from "@/lib/legal/paths";

/**
 * `/izvori` — the citations behind every health number the app computes.
 *
 * Public, and reachable with no account, for the same reason the privacy
 * policy is: this is the URL App Review opens. Guideline 1.4.1 requires the
 * sources of health calculations to be cited and easy to find, and a page
 * behind a login is neither.
 */
export const metadata: Metadata = {
  title: "Odakle brojevi",
  description:
    "Formule i izvori iza FitMess brojeva: Mifflin-St Jeor, faktori aktivnosti, bezbednosne granice kalorija, preporuke za proteine i masti, WHO BMI zone, MET vrednosti i granice za vlakna, šećer, natrijum i zasićene masti.",
  alternates: legalAlternates(SOURCES_PATH, SOURCES_PATH_EN),
  robots: { index: true, follow: true },
};

export default async function IzvoriPage() {
  const { locale, t } = await getT();
  return <MedicalSources locale={locale} t={t} />;
}
