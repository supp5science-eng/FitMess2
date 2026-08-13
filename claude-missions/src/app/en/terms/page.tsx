import type { Metadata } from "next";

import { TermsOfUse } from "@/components/legal/terms-of-use";
import { createT } from "@/lib/i18n/translate";
import { legalAlternates, TERMS_PATH, TERMS_PATH_EN } from "@/lib/legal/paths";

/**
 * `/en/terms` — the terms of use in English.
 *
 * Not asked for by either store, but the footer of every `/en/*` document
 * offers all three: a reader sent to the English privacy policy who taps
 * "Terms of use" and lands back in Serbian has been dropped out of their own
 * language mid-sentence. The English translation already exists — this is the
 * URL that reaches it.
 */
export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The FitMess terms of use: what the app is, what it is not, and what is expected of you.",
  alternates: legalAlternates(TERMS_PATH, TERMS_PATH_EN),
  robots: { index: true, follow: true },
};

export default function EnglishTermsPage() {
  return <TermsOfUse locale="en" t={createT("en")} />;
}
