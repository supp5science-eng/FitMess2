import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Placeholder Privacy Policy page linked from Podešavanja. Deliberately an
// honest "in preparation" stub -- the real, legally-reviewed policy text is
// pending (it must be written/approved by the operator, not fabricated here).
// Wired now so the settings link is not a dead 404 and the final copy can drop
// straight into this route later.
export default function PrivatnostPage() {
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
        Politika privatnosti
      </h1>

      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          FitMess čuva samo podatke koji su potrebni da aplikacija radi: tvoj
          nalog (email, broj telefona), podatke iz upitnika (pol, godine,
          visina, težina, aktivnost, cilj) i unete obroke. Ove podatke koristimo
          isključivo da bismo ti računali plan i pratili napredak.
        </p>
        <p>
          Uneti obroci se u aplikaciji prikazuju 30 dana, a u bazi se čuvaju do
          3 meseca pa se automatski brišu. U svakom trenutku možeš da preuzmeš
          svoje podatke ili obrišeš nalog iz Podešavanja.
        </p>
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-foreground">
          Kompletan, pravno pregledan tekst politike privatnosti je u pripremi i
          biće objavljen ovde uskoro.
        </p>
      </div>
    </main>
  );
}
