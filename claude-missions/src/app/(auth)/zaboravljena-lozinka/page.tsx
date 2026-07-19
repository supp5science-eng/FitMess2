import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * The "zaboravljena lozinka" (forgot password) request page. Public: a
 * signed-out user who forgot their password must be able to reach it (see
 * `isPasswordResetPath` in `src/lib/auth/route-protection.ts`).
 *
 * If arrived at from the login form with an already-typed email, we prefill it
 * via `?email=` so the user doesn't retype it.
 */
export default async function ZaboravljenaLozinkaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>Zaboravljena lozinka</h1>
          <p>
            Unesi email adresu naloga i poslaćemo ti link za postavljanje nove
            lozinke.
          </p>
        </div>
        <ForgotPasswordForm email={email} />
      </div>
      <p className="auth-alt">
        Setio/la si se lozinke? <Link href="/prijava">Prijavi se</Link>
      </p>
    </>
  );
}
