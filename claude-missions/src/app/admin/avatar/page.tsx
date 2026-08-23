import type { Metadata } from "next";

import { AvatarLab } from "./avatar-lab";

/**
 * Lab za avatar rig. Živi pod `/admin/*`, pa ga `src/app/admin/layout.tsx`
 * već zaključava na `profiles.is_admin === true` -- niko osim operatera ga
 * ne vidi, i ne treba mu sopstvena zaštita.
 *
 * Nije feature nego proba: odgovara na jedno pitanje -- da li se raspon od
 * "neaktivno" do "vrhunski" vidi dovoljno jasno da bi imao smisla kao
 * mehanika. Tek kad odgovor bude da, ide ulaganje u likovni stil.
 */
export const metadata: Metadata = {
  title: "Avatar lab",
};

export default function AvatarLabPage() {
  return (
    <main data-testid="admin-avatar" className="flex flex-1 flex-col">
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Avatar lab
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lice se bira, telo se računa. Slajderi su alat za probu, ne budući
          ekran.
        </p>
      </div>
      <AvatarLab />
    </main>
  );
}
