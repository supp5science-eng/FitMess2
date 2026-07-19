import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PasswordForm } from "./password-form";

// `/profil/lozinka` -- change password from within Podešavanja. Server
// Component shell (auth already guaranteed by middleware) around the client
// `PasswordForm`. Back link returns to the settings list.
export default function LozinkaPage() {
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
        Promeni lozinku
      </h1>

      <PasswordForm />
    </main>
  );
}
