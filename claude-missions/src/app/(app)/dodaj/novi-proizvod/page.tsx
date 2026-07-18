import Link from "next/link";

// F031: `/dodaj/novi-proizvod` -- the destination `ScanScreen`
// (`src/components/scan/scan-screen.tsx`) routes to on a barcode-lookup
// MISS (no `foods` row has the scanned GTIN). This feature's scope ends at
// "route here with the GTIN attached" (per the clarified scope: "on a miss,
// navigate to the first-time-entry route with the scanned GTIN -- F032 will
// build that form; a placeholder is fine but pass the GTIN along").
//
// F032 (depends on this feature) replaces the body below with the real
// pre-filled first-time product entry form (name, brand, per-100g values --
// see F032's own draft scope) -- it should read the exact same `barkod`
// search-param this page already reads below, so no query-string contract
// changes are needed between F031 and F032. This placeholder deliberately
// still SHOWS the scanned GTIN (never a blank/broken screen, matching the
// same "prove the scan worked" posture F030's own pre-F031 placeholder
// used) rather than silently discarding it.
//
// Auth is enforced centrally by `src/middleware.ts` (every `/dodaj/*` route
// requires a session, same as `/dodaj/pretraga` and `/dodaj/uskoro/*`) --
// this page does not re-check it itself, matching the `uskoro` page's own
// pattern.

export default async function NoviProizvodPage({
  searchParams,
}: {
  searchParams: Promise<{ barkod?: string | string[] }>;
}) {
  const { barkod } = await searchParams;
  const gtin = Array.isArray(barkod) ? barkod[0] : barkod;

  return (
    <main
      data-testid="novi-proizvod-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <span
        data-testid="novi-proizvod-badge"
        className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        Uskoro
      </span>
      <h1 className="text-lg font-semibold text-foreground">
        Nepoznat proizvod
      </h1>
      {gtin ? (
        <p className="text-sm text-muted-foreground">
          Barkod{" "}
          <span
            data-testid="novi-proizvod-gtin"
            className="font-medium text-foreground"
          >
            {gtin}
          </span>{" "}
          nije u našoj bazi. Uskoro ćeš moći sam da dodaš ovaj proizvod.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ovaj proizvod nije u našoj bazi. Uskoro ćeš moći sam da ga dodaš.
        </p>
      )}
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
