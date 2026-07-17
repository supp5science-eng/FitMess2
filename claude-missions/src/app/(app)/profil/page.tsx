import { signOutAction } from "../actions";
import { Button } from "@/components/ui/button";

/**
 * F013: minimal `/profil` page -- the bottom nav (F005) has pointed at this
 * route since it shipped, but nothing rendered it yet (a 404). This
 * feature's only requirement here is the "Odjavi se" (sign out) control
 * (AS-012); the rest of the profile screen (F0xx, out of this feature's
 * scope) is deliberately left minimal rather than guessed at.
 *
 * The sign-out button is a plain `<form action={signOutAction}>` -- React
 * 19's built-in server-action form handling needs no client-side JS or
 * `"use client"` boundary for this to work.
 */
export default function ProfilPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Profil
      </h1>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Odjavi se
        </Button>
      </form>
    </main>
  );
}
