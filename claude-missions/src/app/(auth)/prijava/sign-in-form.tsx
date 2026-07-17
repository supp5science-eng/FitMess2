"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type AuthFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Prijava u toku…" : "Prijavi se"}
    </Button>
  );
}

/** AS-009 / AS-017: email + password login form. */
export function SignInForm() {
  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={state?.ok === false || undefined}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-password">Lozinka</Label>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
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
