import Link from "next/link";

import { GoogleSignInButton } from "../google-sign-in-button";
import { SignInForm } from "./sign-in-form";

export default async function PrijavaPage({
  searchParams,
}: {
  searchParams: Promise<{ greska?: string }>;
}) {
  const { greska } = await searchParams;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Prijavi se
        </h1>
        <p className="text-sm text-muted-foreground">
          Unesi email i lozinku da nastaviš.
        </p>
      </div>
      {greska === "potvrda" ? (
        <p role="alert" className="text-sm text-destructive">
          Link za potvrdu je istekao ili je već iskorišćen. Prijavi se, ili
          zatraži novi link sa stranice za registraciju.
        </p>
      ) : null}
      <SignInForm />
      <GoogleSignInButton />
      <p className="text-sm text-muted-foreground">
        Nemaš nalog?{" "}
        <Link
          href="/registracija"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Registruj se
        </Link>
      </p>
    </main>
  );
}
