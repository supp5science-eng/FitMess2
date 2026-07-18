import Link from "next/link";

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

const METHOD_COPY: Record<string, { title: string; body: string }> = {
  barkod: {
    title: "Skeniranje barkoda",
    body: "Uskoro ćeš moći da skeniraš barkod proizvoda i odmah dodaš unos.",
  },
  deklaracija: {
    title: "Slikanje deklaracije",
    body: "Uskoro ćeš moći da slikaš nutritivnu deklaraciju, a mi ćemo je pretvoriti u gotov unos.",
  },
  obrok: {
    title: "Slikanje obroka",
    body: "Uskoro ćeš moći da slikaš svoj obrok, a mi ćemo proceniti kalorije i makronutrijente.",
  },
};

const FALLBACK_COPY = {
  title: "Uskoro dostupno",
  body: "Radimo na ovoj funkciji. U međuvremenu, unos možeš dodati pretragom.",
};

export default async function UskoroPage({
  params,
}: {
  params: Promise<{ metoda: string }>;
}) {
  const { metoda } = await params;
  const copy = METHOD_COPY[metoda] ?? FALLBACK_COPY;

  return (
    <main
      data-testid="uskoro-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <span
        data-testid="uskoro-badge"
        className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        Uskoro
      </span>
      <h1 className="text-lg font-semibold text-foreground">{copy.title}</h1>
      <p data-testid="uskoro-body" className="text-sm text-muted-foreground">
        {copy.body}
      </p>
      <Link
        href="/dodaj/pretraga"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Pretraži hranu
      </Link>
      <Link
        href="/danas"
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        Nazad na Danas
      </Link>
    </main>
  );
}
