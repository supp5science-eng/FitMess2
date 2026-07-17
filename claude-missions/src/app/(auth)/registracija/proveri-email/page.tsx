import Link from "next/link";

import { ResendForm } from "./resend-form";

/**
 * AS-009: the Serbian "proveri email" (check your email) notice. Reached
 * after signup, or after a login attempt for an account that has not
 * confirmed its email yet (see the redirect matrix in
 * `src/app/(auth)/actions.ts`). No session exists at this point either way
 * -- Supabase never issues one for an unconfirmed account (verified live;
 * see evidence/F011/live-verification.log) -- so this page itself needs no
 * auth check to stay safe to show to a signed-out visitor.
 */
export default async function ProveriEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Proveri email
        </h1>
        <p className="text-sm text-muted-foreground">
          {email ? (
            <>
              Poslali smo link za potvrdu naloga na <strong>{email}</strong>.
            </>
          ) : (
            "Poslali smo ti link za potvrdu naloga na email adresu koju si uneo/la."
          )}{" "}
          Klikni na link u poruci da bi mogao/la da koristiš aplikaciju.
        </p>
      </div>
      {email ? <ResendForm email={email} /> : null}
      <p className="text-sm text-muted-foreground">
        Već potvrdio/la nalog?{" "}
        <Link
          href="/prijava"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Prijavi se
        </Link>
      </p>
    </main>
  );
}
