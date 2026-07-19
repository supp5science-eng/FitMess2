import { NewProductForm } from "@/components/food/new-product-form";

// F031 built this route as a placeholder destination `ScanScreen`
// (`src/components/scan/scan-screen.tsx`) routes to on a barcode-lookup
// MISS (no `foods` row has the scanned GTIN), passing the GTIN along via
// `?barkod=<gtin>`. F032 / AS-055: replaces that placeholder body with the
// real first-time product entry form (`NewProductForm`), pre-filled with
// the scanned GTIN -- same query-string contract, no URL-shape change.
//
// No server-side auth check here (unlike `/dodaj/pretraga`/`/dodaj/porcija/
// [foodId]`, which read user-owned server data at render time): this route
// has no server data to fetch -- `NewProductForm` is entirely client-driven
// and `POST /api/foods` (this feature) re-verifies the session itself, same
// posture `/dodaj/skener` (F030) already established for a client-driven
// route with no auth-dependent initial render. `src/middleware.ts` (F013)
// already guarantees only an authenticated, verified, onboarded user reaches
// `/dodaj/*` at all.
//
// M7 note (see this feature's own handoff): F063 adds a label-photo prefill
// STEP before this form (auto-filling name/brand/macros from a photographed
// nutrition label) -- this page and `NewProductForm` remain the confirm/edit
// step either way; F063 should feed its own prefilled values into
// `NewProductForm` as new optional props rather than duplicating this form.

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length > 0 ? v : undefined;
}

export default async function NoviProizvodPage({
  searchParams,
}: {
  searchParams: Promise<{
    barkod?: string | string[];
    // F063: prefill from a photographed nutrition label.
    naziv?: string | string[];
    brend?: string | string[];
    kcal?: string | string[];
    protein?: string | string[];
    uh?: string | string[];
    mast?: string | string[];
    izvor?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const gtin = first(params.barkod);
  const fromLabel = first(params.izvor) === "deklaracija";

  return (
    <main
      data-testid="novi-proizvod-page"
      className="flex flex-1 flex-col gap-6 px-6 py-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Novi proizvod
        </h1>
        {fromLabel ? (
          <p className="text-sm text-muted-foreground">
            Popunili smo vrednosti sa deklaracije —{" "}
            <span className="font-medium text-foreground">proveri</span> i
            doteraj po potrebi pa sačuvaj.
          </p>
        ) : gtin ? (
          <p className="text-sm text-muted-foreground">
            Barkod{" "}
            <span
              data-testid="novi-proizvod-gtin"
              className="font-medium text-foreground"
            >
              {gtin}
            </span>{" "}
            nije u našoj bazi. Dodaj ga i biće odmah dostupan svima.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ova namirnica nije u našoj bazi. Dodaj je i biće odmah dostupna
            svima.
          </p>
        )}
      </div>

      <NewProductForm
        initialBarcode={gtin}
        initialName={first(params.naziv)}
        initialBrand={first(params.brend)}
        initialKcal={first(params.kcal)}
        initialProtein={first(params.protein)}
        initialCarbs={first(params.uh)}
        initialFat={first(params.mast)}
      />
    </main>
  );
}
