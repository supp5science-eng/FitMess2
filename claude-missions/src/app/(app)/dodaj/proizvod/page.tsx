import { DodajProizvodFlow } from "./dodaj-proizvod-flow";

/**
 * `/dodaj/proizvod` -- the dedicated "Dodaj proizvod" flow, reachable from the
 * home "+" sheet in 2 taps. Adds a PACKAGED catalog product that has a
 * nutrition declaration AND a barcode: scan/upload the barcode, then fill (or
 * photograph) the nutrition values and an optional price.
 *
 * A thin server-component wrapper only -- the whole flow is a client-side
 * camera/upload + form interaction (`DodajProizvodFlow`), and the writes it
 * performs (`POST /api/foods`, the label-estimate server action) re-verify the
 * session themselves, the same posture `/dodaj/skener` and `/dodaj/novi-
 * proizvod` already established. `src/middleware.ts` (F013) already guarantees
 * only an authenticated, verified, onboarded user reaches `/dodaj/*`.
 */
export default function DodajProizvodPage() {
  return <DodajProizvodFlow />;
}
