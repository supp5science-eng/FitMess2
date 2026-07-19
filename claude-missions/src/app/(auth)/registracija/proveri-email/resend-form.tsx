"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { resendAction, type AuthFormState } from "../../actions";

const initialState: AuthFormState = null;
/** GoTrue enforces a ~60s minimum between confirmation emails per address; we
 * mirror it client-side so the button visibly counts down instead of letting
 * the user tap into a rate-limit error that reads as "resend is broken". */
const COOLDOWN_SECONDS = 60;

function ResendButton({
  cooldown,
  onStart,
}: {
  cooldown: number;
  onStart: () => void;
}) {
  const { pending } = useFormStatus();
  const waiting = cooldown > 0;
  return (
    <button
      type="submit"
      className="auth-btn auth-btn-ghost"
      disabled={pending || waiting}
      // Start the cooldown at click time (an event, not an effect) so the very
      // next click can't fall inside GoTrue's per-address send window.
      onClick={onStart}
    >
      {pending
        ? "Slanje…"
        : waiting
          ? `Pošalji ponovo (${cooldown}s)`
          : "Pošalji ponovo"}
    </button>
  );
}

/**
 * AS-009: "pošalji ponovo" resend action on the verification notice.
 *
 * `initialCooldown` is set (to 60) when the page was reached straight from
 * signup, so the button starts already counting down -- an immediate first
 * click right after the signup email would otherwise be rejected by GoTrue's
 * per-address send window. Every submit (success or failure) restarts the
 * cooldown so a rapid second click can't hit the same wall.
 */
export function ResendForm({
  email,
  initialCooldown = 0,
}: {
  email: string;
  initialCooldown?: number;
}) {
  const [state, formAction] = useActionState(resendAction, initialState);
  const [cooldown, setCooldown] = useState(initialCooldown);

  // Tick the countdown down to zero. Setting state inside the timer callback
  // (not synchronously in the effect body) is the intended, lint-clean pattern.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="email" value={email} />
      <ResendButton
        cooldown={cooldown}
        onStart={() => setCooldown(COOLDOWN_SECONDS)}
      />
      {state ? (
        <p role="status" className={state.ok ? "auth-notice" : "auth-error"}>
          {state.ok
            ? "Poslali smo novi link za potvrdu na tvoj email. Proveri i „Spam“ / „Promocije“ folder."
            : state.error_sr}
        </p>
      ) : null}
    </form>
  );
}
