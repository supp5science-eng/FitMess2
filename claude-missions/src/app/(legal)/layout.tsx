import { LegalChrome } from "@/components/legal/legal-chrome";
import { getT } from "@/lib/i18n/server";
import {
  ACCOUNT_DELETION_PATH,
  PRIVACY_PATH,
  SOURCES_PATH,
  TERMS_PATH,
} from "@/lib/legal/paths";

/**
 * Frame for the three canonical legal documents. The language follows the
 * `fm_locale` cookie like the rest of the app; the fixed-English rendering of
 * the same documents lives at `/en/*` (`src/app/en/layout.tsx`).
 *
 * Everything about the frame itself — why it is full-bleed, why the footer
 * carries the other documents — is explained on `LegalChrome`.
 */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getT();

  const links = [
    { href: PRIVACY_PATH, label: t("legal.link.privacy") },
    { href: TERMS_PATH, label: t("legal.link.terms") },
    { href: ACCOUNT_DELETION_PATH, label: t("legal.link.delete") },
    // A reviewer who opened the privacy policy is one tap from the citations
    // guideline 1.4.1 asks for — "easy for the user to find" starts here.
    { href: SOURCES_PATH, label: t("legal.link.sources") },
  ];

  return (
    <LegalChrome t={t} links={links}>
      {children}
    </LegalChrome>
  );
}
