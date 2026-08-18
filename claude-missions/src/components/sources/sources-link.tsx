import Link from "next/link";
import { BookOpen } from "lucide-react";

import { SOURCES_PATH } from "@/lib/legal/paths";
import type { TFunction } from "@/lib/i18n/translate";

/**
 * "Odakle ovaj broj?" — the quiet link that sits next to a computed health
 * number and leads to the citations behind it.
 *
 * ## Why it is not just a Settings row
 *
 * App Review's wording under **guideline 1.4.1** is that the citations must be
 * "easy for the user to find". A sources page that exists but is only reachable
 * from the bottom of Podešavanja satisfies the letter and not the sentence: the
 * person looking at "2.180 kcal" is on the screen showing the number, not in
 * Settings. So the link goes where the number is.
 *
 * ## Two destinations, on purpose
 *
 * - `variant="app"` → `/profil/izvori`, the in-app rendering, which keeps the
 *   app's navigation. Used on every signed-in screen, because the public
 *   document renders full-bleed with no way back — the "no exits" rule.
 * - `variant="public"` → `/izvori`. Used on the pre-auth plan preview at
 *   `/upitnik`, where the visitor has no session and `/profil/*` would bounce
 *   them to the login screen. Sending someone to a login form when they asked
 *   where a number came from is the same as not answering.
 *
 * Deliberately understated: this is a footnote, not a warning. It must never
 * compete with the number it explains, and it must never look like the app is
 * hedging about it.
 */
export function SourcesLink({
  t,
  variant = "app",
  className = "",
}: {
  t: TFunction;
  variant?: "app" | "public";
  className?: string;
}) {
  const href = variant === "public" ? SOURCES_PATH : "/profil/izvori";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground ${className}`}
    >
      <BookOpen className="size-3.5 shrink-0" aria-hidden={true} />
      {t("sources.link.short")}
    </Link>
  );
}
