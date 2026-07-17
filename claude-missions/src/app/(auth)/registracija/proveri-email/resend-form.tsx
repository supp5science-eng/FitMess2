"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resendAction, type AuthFormState } from "../../actions";
import { Button } from "@/components/ui/button";

const initialState: AuthFormState = null;

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? "Slanje…" : "Pošalji ponovo"}
    </Button>
  );
}

/** AS-009: "posalji ponovo" resend action on the verification notice. */
export function ResendForm({ email }: { email: string }) {
  const [state, formAction] = useActionState(resendAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <ResendButton />
      {state ? (
        <p
          role="status"
          className={
            state.ok
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
        >
          {state.ok
            ? "Poslali smo novi link za potvrdu na tvoj email."
            : state.error_sr}
        </p>
      ) : null}
    </form>
  );
}
