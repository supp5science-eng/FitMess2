import Link from "next/link";

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
 *
 * F017 added the single "Pravila ishrane" link below, pointing at
 * `/profil/pravila` (AS-028/AS-029) -- the only integration point this
 * feature needed on the pre-existing profile screen.
 *
 * F018 added the "Preuzmi moje podatke" link below (AS-014) -- a plain
 * anchor to `/api/export`, no client-side JS needed: the browser's normal
 * navigation plus that route's `Content-Disposition: attachment` header is
 * what triggers the download.
 */
export default function ProfilPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Profil
      </h1>
      <Link
        href="/profil/pravila"
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-muted"
      >
        Pravila ishrane
      </Link>
      <a
        href="/api/export"
        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-muted"
      >
        Preuzmi moje podatke
      </a>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          Odjavi se
        </Button>
      </form>
    </main>
  );
}
