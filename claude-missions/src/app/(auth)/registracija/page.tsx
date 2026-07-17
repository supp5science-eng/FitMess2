import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

export default function RegistracijaPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Napravi nalog
        </h1>
        <p className="text-sm text-muted-foreground">
          Unesi email i lozinku da bi počeo/la sa praćenjem ishrane.
        </p>
      </div>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Već imaš nalog?{" "}
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
