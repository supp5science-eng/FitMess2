import Link from "next/link";

import { getT } from "@/lib/i18n/server";

/**
 * F028 / AS-051: "uskoro" (coming soon) placeholder for logging methods
 * that are not built yet -- barcode scanning (F030/M4), nutrition-label
 * photos and meal photos (F062/F064/M7). `AddSheet`'s three not-yet-
 * available options link here instead of a broken 404 or a dead click, per
 * the clarified scope note ("route them to a clear Serbian 'uskoro'
 * placeholder ... NOT a broken 404"). This keeps every logging method
 * reachable in exactly 2 taps from the home screen (tap "+", tap the
 * method) even before the method itself exists.
 *
 * A future F030/F062/F064 replaces the corresponding `AddSheet` row's
 * `href` with the real flow -- this route and page stay as a fallback for
 * any lingering link/bookmark, and this page itself never needs to change.
 */

export default async function UskoroPage({
  params,
}: {
  params: Promise<{ metoda: string }>;
}) {
  const { metoda } = await params;
  const { t } = await getT();

  const methodCopy: Record<string, { title: string; body: string }> = {
    barkod: {
      title: t("dodaj.soon.barkod.title"),
      body: t("dodaj.soon.barkod.body"),
    },
    deklaracija: {
      title: t("dodaj.soon.deklaracija.title"),
      body: t("dodaj.soon.deklaracija.body"),
    },
    obrok: {
      title: t("dodaj.soon.obrok.title"),
      body: t("dodaj.soon.obrok.body"),
    },
  };

  const copy = methodCopy[metoda] ?? {
    title: t("dodaj.soon.fallback.title"),
    body: t("dodaj.soon.fallback.body"),
  };

  return (
    <main
      data-testid="uskoro-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <span
        data-testid="uskoro-badge"
        className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        {t("dodaj.soon.badge")}
      </span>
      <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
      <p data-testid="uskoro-body" className="text-sm text-muted-foreground">
        {copy.body}
      </p>
      <Link
        href="/dodaj/pretraga"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        {t("dodaj.soon.searchFood")}
      </Link>
      <Link
        href="/danas"
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("dodaj.soon.backToToday")}
      </Link>
    </main>
  );
}
