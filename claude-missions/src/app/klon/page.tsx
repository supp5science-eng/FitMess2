import type { Metadata } from "next";

import { KlonScreen } from "@/components/avatar/klon-screen";

/**
 * `/klon` -- the first screen of the funnel.
 *
 * Landing "Kreni" lands here, BEFORE the questionnaire: the visitor makes their
 * avatar first and answers questions second (product decision, 2026-08-24 --
 * the klon is the thing worth showing people, so it goes where it is seen).
 *
 * Public on purpose. There is no account yet, nothing is written server-side,
 * and the drawing lives in the visitor's own browser until they register (see
 * `@/lib/avatar/klon-stash` and `/api/klon`). `/onboarding/klon` picks it up
 * from there.
 *
 * Its own full-bleed layout for the same reason `/upitnik` has one: the app
 * shell's centred column and bottom navigation belong to a signed-in user, and
 * nobody here is one yet.
 */
export const metadata: Metadata = {
  title: "Napravi svog klona",
};

export default function PublicKlonPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <main data-testid="klon-javni" className="flex flex-1 flex-col">
          <KlonScreen mode="javni" />
        </main>
      </div>
    </div>
  );
}
