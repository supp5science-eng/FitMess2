"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signUpAction, type AuthFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Registracija u toku…" : "Napravi nalog"}
    </Button>
  );
}

/** AS-008: email + password signup form. */
export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state?.ok === false || undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signup-password">Lozinka</Label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={state?.ok === false || undefined}
        />
      </div>
      {state?.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
