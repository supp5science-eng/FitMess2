import Link from "next/link";

import { GoogleSignInButton } from "../google-sign-in-button";
import { SignUpForm } from "./sign-up-form";

export default async function RegistracijaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // Carried back from the "proveri email" screen when the user realizes they
  // mistyped their address ("Pogrešan email? Izmeni") — so they don't retype
  // it from scratch.
  const { email } = await searchParams;

  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>Napravi nalog</h1>
          <p>Unesi email i lozinku da bi počeo/la sa praćenjem ishrane.</p>
        </div>
        <SignUpForm initialEmail={email} />
        <GoogleSignInButton />
      </div>
      <p className="auth-alt">
        Već imaš nalog? <Link href="/prijava">Prijavi se</Link>
      </p>
    </>
  );
}
