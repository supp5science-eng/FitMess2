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
    <>
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-head" style={{ alignItems: "center" }}>
          <h1>Proveri email</h1>
          <p>
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
      </div>
      <p className="auth-alt">
        Već potvrdio/la nalog? <Link href="/prijava">Prijavi se</Link>
      </p>
    </>
  );
}
