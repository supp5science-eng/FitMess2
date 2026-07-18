"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signUpAction, type AuthFormState } from "../actions";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Registracija u toku…" : "Napravi nalog"}
    </button>
  );
}

/** AS-008: email + password signup form. */
export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialState);
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          className="auth-input"
          placeholder="ti@email.com"
          autoComplete="email"
          required
          aria-invalid={invalid}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="signup-password">Lozinka</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          className="auth-input"
          placeholder="Bar 8 karaktera"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={invalid}
        />
      </div>
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
