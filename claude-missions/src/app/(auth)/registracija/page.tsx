import Link from "next/link";

import { GoogleSignInButton } from "../google-sign-in-button";
import { SignUpForm } from "./sign-up-form";

export default function RegistracijaPage() {
  return (
    <>
      <div className="auth-card">
        <div className="auth-head">
          <h1>Napravi nalog</h1>
          <p>Unesi email i lozinku da bi počeo/la sa praćenjem ishrane.</p>
        </div>
        <SignUpForm />
        <GoogleSignInButton />
      </div>
      <p className="auth-alt">
        Već imaš nalog? <Link href="/prijava">Prijavi se</Link>
      </p>
    </>
  );
}
