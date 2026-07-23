import Link from "next/link";

import { GoogleSignInButton } from "../google-sign-in-button";
import { SignInForm } from "./sign-in-form";

export default async function PrijavaPage({
  searchParams,
}: {
  searchParams: Promise<{ greska?: string; email?: string }>;
}) {
  const { greska, email } = await searchParams;

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>Prijavi se</h1>
          <p>Unesi email i lozinku da nastaviš.</p>
        </div>
        {greska === "potvrda" ? (
          <p role="alert" className="auth-error">
            Link za potvrdu je istekao ili je već iskorišćen. Prijavi se, ili
            zatraži novi link sa stranice za registraciju.
          </p>
        ) : null}
        <SignInForm initialEmail={email} />
        <p className="auth-alt" style={{ marginTop: 0 }}>
          <Link href="/zaboravljena-lozinka">Zaboravio/la si lozinku?</Link>
        </p>
        <GoogleSignInButton />
      </div>
      <p className="auth-alt">
        Nemaš nalog? <Link href="/registracija">Registruj se</Link>
      </p>
    </>
  );
}
