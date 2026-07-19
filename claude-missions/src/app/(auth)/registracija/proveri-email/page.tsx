import Link from "next/link";

import { ResendForm } from "./resend-form";
import { VerifyCodeForm } from "./verify-code-form";

/**
 * AS-009: the Serbian "proveri email" notice. Reached after signup, or after a
 * login attempt for an account that has not confirmed its email yet (see the
 * redirect matrix in `src/app/(auth)/actions.ts`). No session exists at this
 * point either way -- Supabase never issues one for an unconfirmed account --
 * so this page itself needs no auth check to stay safe for a signed-out
 * visitor.
 *
 * The primary confirmation path here is the in-app 6-digit CODE
 * (`VerifyCodeForm`): the user types it without ever leaving the installed
 * PWA. The email link still works too, but on iOS it opens Safari/Chrome and
 * drops the user out of the app -- so the code is what we lead with. The code
 * form needs the address (to call `verifyOtp({ email, token })`), so it only
 * renders when we have `?email=`.
 */
export default async function ProveriEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; poslato?: string }>;
}) {
  const { email, poslato } = await searchParams;
  // Fresh from signup (email just sent) -> start the resend button on a
  // cooldown so the first click can't hit GoTrue's per-address send window.
  const justSent = poslato === "1";

  return (
    <>
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-head" style={{ alignItems: "center" }}>
          <h1>Potvrdi nalog</h1>
          <p>
            {email ? (
              <>
                Poslali smo 6-cifreni kod na <strong>{email}</strong>.
              </>
            ) : (
              "Poslali smo ti 6-cifreni kod na email adresu koju si uneo/la."
            )}{" "}
            Unesi ga ispod da završiš registraciju.
          </p>
        </div>

        {email ? <VerifyCodeForm email={email} /> : null}

        <div className="auth-sep" role="separator">
          Nisi dobio/la kod?
        </div>

        {email ? (
          <ResendForm email={email} initialCooldown={justSent ? 60 : 0} />
        ) : (
          <p className="auth-hint">
            Vrati se na{" "}
            <Link href="/registracija">registraciju</Link> da ponovo zatražiš
            kod.
          </p>
        )}

        <p className="auth-hint">
          Otvaraš na računaru? Možeš i da klikneš link iz mejla.
        </p>
      </div>
      <p className="auth-alt">
        Već potvrdio/la nalog? <Link href="/prijava">Prijavi se</Link>
      </p>
    </>
  );
}
