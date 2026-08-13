import type { Metadata } from "next";

import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { createT } from "@/lib/i18n/translate";
import { legalAlternates, PRIVACY_PATH, PRIVACY_PATH_EN } from "@/lib/legal/paths";

/**
 * `/en/privacy` — the privacy policy in English, for a reader with no cookie.
 *
 * Same component as `/privatnost`, so the two languages can never drift into
 * saying different things about what is collected. The canonical stays the
 * Serbian URL: one document, one indexable address, with `hreflang` pointing
 * at this rendering for anyone who wants it in English.
 */
export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What FitMess collects, why, who else sees it, how long it is kept and how to erase it.",
  alternates: legalAlternates(PRIVACY_PATH, PRIVACY_PATH_EN),
  robots: { index: true, follow: true },
};

export default function EnglishPrivacyPage() {
  return <PrivacyPolicy locale="en" t={createT("en")} />;
}
