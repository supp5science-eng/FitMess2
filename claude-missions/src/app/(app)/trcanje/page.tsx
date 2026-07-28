import { Footprints, MapPin } from "lucide-react";

/**
 * `/trcanje` — the Trčanje home (F-runs), fourth tab in the bottom nav.
 *
 * SKELETON: this establishes the route + nav entry. The live map, the "Kreni"
 * recording flow (`/trcanje/snimanje`), the run summary (`/trcanje/[id]`), and
 * the recent-runs history are built in the next steps; for now the screen shows
 * the calm, zero-shame intro state so the tab resolves and the shell renders.
 *
 * Server Component: it will read the caller's recent `runs` (own-row RLS) once
 * the history section lands — same pattern as `/nagrada` / `/danas`.
 */
export default function TrcanjePage() {
  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <Footprints className="size-5 text-primary" aria-hidden="true" />
          Trčanje
        </h1>
        <p className="text-sm text-muted-foreground">
          Snimi trčanje i vrati istrčane kalorije u svoj dnevni budžet.
        </p>
      </header>

      {/* Map placeholder — the live Google Maps route lands with the recording
          screen (needs the Maps API key). */}
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card text-center">
        <MapPin className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="max-w-[15rem] text-sm text-muted-foreground">
          Ovde će biti mapa uživo — tvoja ruta se crta dok trčiš.
        </p>
      </div>

      {/* "Kreni" is intentionally inert in this skeleton — the recording flow is
          the next step. Rendered so the layout is real, disabled so it can't go
          to a page that doesn't exist yet. */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="liquid-glass inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground opacity-50"
        >
          <Footprints className="size-5" aria-hidden="true" />
          Kreni
        </button>
        <p className="text-xs text-muted-foreground">
          Snimanje trčanja stiže u sledećem koraku.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Prethodna trčanja</h2>
        <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Još nema trčanja. Tvoja prva ruta pojaviće se ovde.
          </p>
        </div>
      </section>
    </main>
  );
}
