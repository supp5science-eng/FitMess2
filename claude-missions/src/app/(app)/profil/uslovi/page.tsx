import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Placeholder Terms of Use page linked from Podešavanja. Honest "in
// preparation" stub -- final, legally-reviewed terms are pending. Wired now so
// the settings link is not a dead 404.
export default function UsloviPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        Podešavanja
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Uslovi korišćenja
      </h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          FitMess je alat za praćenje ishrane i pomoć pri postizanju tvog cilja.
          Procene kalorija i makronutrijenata su informativne prirode i ne
          predstavljaju medicinski savet. Za zdravstvene odluke posavetuj se sa
          lekarom ili nutricionistom.
        </p>
        <p>
          Odgovoran si za tačnost podataka koje unosiš. Trudimo se da baza
          namirnica bude tačna, ali ne garantujemo da je svaka vrednost bez
          greške.
        </p>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-foreground">
          Kompletni, pravno pregledani uslovi korišćenja su u pripremi i biće
          objavljeni ovde uskoro.
        </p>
      </div>
    </main>
  );
}
