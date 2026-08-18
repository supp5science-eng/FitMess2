import { LegalChrome } from "@/components/legal/legal-chrome";
import { createT } from "@/lib/i18n/translate";
import {
  ACCOUNT_DELETION_PATH_EN,
  PRIVACY_PATH_EN,
  SOURCES_PATH_EN,
  TERMS_PATH_EN,
} from "@/lib/legal/paths";

/**
 * `/en/*` — the legal documents with the language pinned by the URL.
 *
 * Everywhere else in FitMess the language comes from the `fm_locale` cookie
 * (`src/lib/i18n/locale.ts`), set from Settings. That is right for a user and
 * useless for the reader these pages were written for: an App Store or Play
 * reviewer opens a URL cold, with no cookie and no app, and gets Serbian. So
 * these routes call `createT("en")` directly and never read the cookie —
 * the URL IS the language.
 *
 * `lang="en"` is set on the content wrapper rather than on `<html>` because
 * only the root layout can write the `<html>` attribute, and it resolves from
 * the same cookie this group deliberately ignores.
 */
export default function EnglishLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = createT("en");

  const links = [
    { href: PRIVACY_PATH_EN, label: t("legal.link.privacy") },
    { href: TERMS_PATH_EN, label: t("legal.link.terms") },
    { href: ACCOUNT_DELETION_PATH_EN, label: t("legal.link.delete") },
    { href: SOURCES_PATH_EN, label: t("legal.link.sources") },
  ];

  return (
    <LegalChrome t={t} links={links} lang="en">
      {children}
    </LegalChrome>
  );
}
