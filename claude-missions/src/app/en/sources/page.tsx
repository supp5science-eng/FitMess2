import type { Metadata } from "next";

import { MedicalSources } from "@/components/legal/medical-sources";
import { createT } from "@/lib/i18n/translate";
import { legalAlternates, SOURCES_PATH, SOURCES_PATH_EN } from "@/lib/legal/paths";

/**
 * `/en/sources` — the same citations in English.
 *
 * This is the one `/en/*` document that is not merely a courtesy: an App
 * Review reviewer reading Serbian prose cannot judge whether the health
 * calculations are cited, and "our citations are in Serbian" is not an answer
 * to guideline 1.4.1. The bibliography is identical either way — it is
 * untranslated by design (`src/lib/legal/sources.ts`).
 */
export const metadata: Metadata = {
  title: "Where the numbers come from",
  description:
    "The equations and sources behind the numbers FitMess shows: Mifflin-St Jeor, activity factors, calorie safety limits, protein and fat recommendations, WHO BMI zones, MET values, and the fibre, sugar, sodium and saturated-fat limits.",
  alternates: legalAlternates(SOURCES_PATH, SOURCES_PATH_EN),
  robots: { index: true, follow: true },
};

export default function EnglishSourcesPage() {
  return <MedicalSources locale="en" t={createT("en")} />;
}
