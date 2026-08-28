import type { Metadata } from "next";

import { listVideoModels } from "@/lib/ai/veo";

import { OkretBench } from "./okret-bench";

/**
 * `/admin/okret` -- klupa za avatar koji se okreće.
 *
 * PROBA, ne feature. Postoji da se jedno pitanje odgovori gledanjem umesto
 * raspravom: da li niz fotografija jednog čoveka iz više uglova, koji se vrti
 * prevlačenjem prsta, izgleda dovoljno dobro da bude ono čime se aplikacija
 * predstavlja na početnom ekranu.
 *
 * Nasleđuje `/admin/klon3d`, koji je isto pitanje postavio za pravi 3D mesh i
 * odgovorio odrečno (24.08.2026: četiri nacrtana pogleda -> image-to-3D -> lice
 * kao vosak). Razlika je u tome što ovde kadrovi OSTAJU FOTOGRAFIJE do kraja --
 * nema rekonstrukcije koja ih pretvara u geometriju.
 *
 * `/admin/layout.tsx` već zaključava celu sekciju na `profiles.is_admin`.
 */
export const metadata: Metadata = {
  title: "Okret",
};

/** Uvek sveže: koje modele ključ vidi menja se sa ključem i sa planom, a
 *  keširano „nema video modela" bilo bi gore nego beskorisno. */
export const dynamic = "force-dynamic";

export default async function OkretPage() {
  /**
   * Ne nagađaj ime modela -- pitaj ključ.
   *
   * `docs/klon.md` je ovu lekciju već platio na slikama: Google preimenuje
   * preview modele bez najave, i tada poziv vrati 404 koji izgleda kao da
   * funkcija uopšte ne radi. Lista se dovlači pre nego što se potroši ijedan
   * kredit, pa se prazna lista čita kao „ključ nema pristup", a ne kao „ovo je
   * neizvodljivo".
   *
   * Pad ovog poziva NE SME da obori stranicu: klupa i dalje radi za kadar
   * (koji ide preko image modela) čak i kad je video nedostupan.
   */
  let videoModeli: string[] = [];
  let greskaModela: string | null = null;
  try {
    videoModeli = (await listVideoModels()).map((model) => model.name);
  } catch (err) {
    greskaModela = err instanceof Error ? err.message.slice(0, 300) : String(err);
  }

  return (
    <main data-testid="admin-okret" className="flex flex-1 flex-col gap-6 px-5 pb-16 pt-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Okret
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Slike → kadar po šablonu → orbit → frejmovi koje vrtiš prstom. Ništa se
          ne čuva.
        </p>
      </div>

      {greskaModela && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Ne mogu da pročitam listu modela sa ključa.
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
            {greskaModela}
          </pre>
        </div>
      )}

      <OkretBench videoModeli={videoModeli} />

      <p className="text-xs text-muted-foreground">
        Cena po pokušaju: kadar je jedan poziv ka image modelu (dva ako je
        uključen referentni portret), orbit je jedan video. Broj isečenih
        frejmova se ne plaća — seku se iz snimka koji je već napravljen.
      </p>
    </main>
  );
}
