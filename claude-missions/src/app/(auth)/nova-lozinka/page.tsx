import Link from "next/link";

import { NewPasswordForm } from "./new-password-form";

/**
 * The "nova lozinka" (set new password) page the recovery email lands on.
 *
 * The emailed link points at `/auth/confirm?type=recovery&next=/nova-lozinka`;
 * that route verifies the one-time token (`verifyOtp`), which establishes a
 * short-lived recovery session, then redirects here. This page itself needs no
 * auth gate -- it is public (`isPasswordResetPath`) so the recovery-session
 * user is never bounced to `/onboarding` first -- and the actual authority to
 * change the password comes from that session, which `resetPasswordAction`
 * relies on. A visitor who opens this page without a valid recovery session
 * simply gets the "link expired, request a new one" error on submit.
 */
export default function NovaLozinkaPage() {
  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>Nova lozinka</h1>
          <p>Postavi novu lozinku za svoj nalog.</p>
        </div>
        <NewPasswordForm />
      </div>
      <p className="auth-alt">
        Link je istekao? <Link href="/zaboravljena-lozinka">Zatraži novi</Link>
      </p>
    </>
  );
}
