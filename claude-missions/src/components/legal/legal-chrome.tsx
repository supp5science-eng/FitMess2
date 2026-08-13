import Link from "next/link";

import { LegalBackLink } from "@/components/legal/legal-back-link";
import type { TFunction } from "@/lib/i18n/translate";
import { CONTROLLER } from "@/lib/legal/controller";

/**
 * Frame for the public legal documents, shared by the Serbian route group
 * (`src/app/(legal)/layout.tsx`) and the English one (`src/app/en/layout.tsx`).
 *
 * Full-bleed on purpose (see `FULL_BLEED_ROUTES` in
 * `src/components/shell/app-shell.tsx`): the reader here is usually a store
 * reviewer on a laptop with no account, and the app's bottom navigation links
 * into pages they cannot open. A signed-out visitor tapping "Početna" and
 * landing on a login screen is a worse first impression than no navigation at
 * all.
 *
 * So the only chrome is the wordmark (back to the landing page) and a footer
 * that reaches the other two documents — because a reviewer who opened the
 * privacy policy usually wants the deletion page next. `links` is passed in
 * rather than imported so each group keeps the reader inside its own language:
 * the footer of an `/en/*` page must lead to `/en/*`, not back into Serbian.
 */
export function LegalChrome({
  t,
  links,
  lang,
  children,
}: {
  t: TFunction;
  /** The other documents, in this page's language. */
  links: { href: string; label: string }[];
  /**
   * BCP-47 tag for the content, set when this subtree's language differs from
   * the `<html lang>` the root layout renders from the `fm_locale` cookie.
   * The `/en/*` documents are English for every reader, cookie or not, and a
   * screen reader that announces English prose with Serbian pronunciation is
   * the failure this prevents.
   */
  lang?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background" lang={lang}>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-foreground"
          >
            Fit<span className="fm-wordmark-accent">Mess</span>
          </Link>
          {/* Only appears for a reader who arrived from somewhere — most often
              the signup form, whose half-filled fields survive a history back
              but not a trip through the landing page. */}
          <LegalBackLink label={t("legal.backLink")} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 py-6 text-sm text-muted-foreground">
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p>
            {CONTROLLER.name} ·{" "}
            <a
              href={`mailto:${CONTROLLER.email}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              {CONTROLLER.email}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
