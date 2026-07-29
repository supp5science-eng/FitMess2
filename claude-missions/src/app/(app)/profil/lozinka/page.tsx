import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getT } from "@/lib/i18n/server";

import { PasswordForm } from "./password-form";

// `/profil/lozinka` -- change password from within Podešavanja. Server
// Component shell (auth already guaranteed by middleware) around the client
// `PasswordForm`. Back link returns to the settings list.
export default async function LozinkaPage() {
  const { t } = await getT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        {t("settings.title")}
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {t("settings.password")}
      </h1>

      <PasswordForm />
    </main>
  );
}
