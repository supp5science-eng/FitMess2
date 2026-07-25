"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIAL_CODES, splitPhone } from "@/lib/auth/dial-codes";

import { changePhoneAction } from "./actions";

/**
 * "Broj telefona" edit form in Podešavanja.
 *
 * App-styled (Input/Label + theme tokens) rather than the auth.css-scoped
 * `PhoneField` from signup -- auth.css only loads inside the `(auth)` layout,
 * and this page lives in the app shell. The country list is shared
 * (`DIAL_CODES`) so the two can't drift.
 *
 * It PREFILLS the number already on the profile: reaching this row from
 * settings means "my number changed / I typed it wrong", not "I never gave
 * one", so starting from an empty field (as the `/telefon` capture gate did)
 * reads like the app forgot.
 */
export function PhoneForm({ phone }: { phone: string | null }) {
  const router = useRouter();
  const initial = splitPhone(phone);

  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [local, setLocal] = useState(initial.local);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ccId = useId();
  const localId = useId();

  const unchanged = dialCode === initial.dialCode && local === initial.local;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await changePhoneAction({ dialCode, local });
      if (!result.ok) {
        setError(result.error_sr ?? "Nešto nije uspelo. Pokušaj ponovo.");
        return;
      }
      setSaved(true);
      // Let the settings list re-read the profile, then go back to it.
      router.refresh();
      setTimeout(() => router.push("/profil"), 900);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={localId}>Broj telefona</Label>
        <div className="flex gap-2">
          <select
            id={ccId}
            value={dialCode}
            onChange={(e) => setDialCode(e.target.value)}
            aria-label="Pozivni broj države"
            // 16px text: anything smaller makes iOS Safari zoom the page in on
            // focus and never zoom back out.
            className="h-11 shrink-0 rounded-lg border border-input bg-transparent px-3 text-base text-foreground"
          >
            {DIAL_CODES.map((country) => (
              <option key={`${country.code} ${country.name}`} value={country.code}>
                {country.flag} {country.code}
              </option>
            ))}
          </select>
          <Input
            id={localId}
            name="phone_local"
            type="tel"
            inputMode="numeric"
            placeholder="60 1234 567"
            autoComplete="tel-national"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={local}
            // Digits and spaces only while typing; the action strips the rest
            // anyway when it builds the E.164 value.
            onChange={(e) => setLocal(e.target.value.replace(/[^\d\s]/g, ""))}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Čuvamo ga samo da bismo mogli da te kontaktiramo — nikad se ne koristi
          za prijavu i ne šaljemo ti SMS.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-medium text-primary">
          Broj telefona je sačuvan.
        </p>
      ) : null}

      <Button type="submit" disabled={pending || saved || unchanged}>
        {pending ? "Čuvam…" : "Sačuvaj broj"}
      </Button>
    </form>
  );
}
