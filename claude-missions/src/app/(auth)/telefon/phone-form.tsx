"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { savePhoneAction, type AuthFormState } from "../actions";
import { PhoneField } from "../registracija/phone-field";

const initialState: AuthFormState = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-primary" disabled={pending}>
      {pending ? "Čuvanje…" : "Sačuvaj i nastavi"}
    </button>
  );
}

/**
 * The `/telefon` capture form. Reuses the exact same `PhoneField` as signup
 * (dial-code picker + local number); on success `savePhoneAction` writes the
 * number to the profile and redirects onward.
 */
export function PhoneForm() {
  const [state, formAction] = useActionState(savePhoneAction, initialState);
  const invalid = state?.ok === false || undefined;

  return (
    <form action={formAction} className="auth-form" noValidate>
      <PhoneField invalid={invalid} />
      {state?.ok === false ? (
        <p role="alert" className="auth-error">
          {state.error_sr}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
