"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resendAction, type AuthFormState } from "../../actions";

const initialState: AuthFormState = null;

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-btn auth-btn-ghost" disabled={pending}>
      {pending ? "Slanje…" : "Pošalji ponovo"}
    </button>
  );
}

/** AS-009: "posalji ponovo" resend action on the verification notice. */
export function ResendForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resendAction, initialState);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="email" value={email} />
      <ResendButton />
      {state ? (
        <p role="status" className={state.ok ? "auth-notice" : "auth-error"}>
          {state.ok
            ? "Poslali smo novi link za potvrdu na tvoj email."
            : state.error_sr}
        </p>
      ) : null}
    </form>
  );
}
