"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DIAL_CODES, splitPhone } from "@/lib/auth/dial-codes";
import { cn } from "@/lib/utils";

import { changePhoneAction } from "./actions";

/**
 * "Broj telefona" edit form in Podešavanja.
 *
 * App-styled rather than the auth.css-scoped `PhoneField` from signup --
 * auth.css only loads inside the `(auth)` layout, and this page lives in the
 * app shell. The country list is shared (`DIAL_CODES`) so the two can't drift.
 *
 * It PREFILLS the number already on the profile: reaching this row from
 * settings means "my number changed / I typed it wrong", not "I never gave
 * one", so starting from an empty field (as the `/telefon` capture gate did)
 * reads like the app forgot.
 *
 * The dial code and the number share ONE bordered field with a hairline
 * between them (the rest of the app's inputs are single 40-44px controls; two
 * separately-boxed controls of different heights sitting side by side looked
 * broken). The whole field lights up together on focus.
 */
export function PhoneForm({ phone }: { phone: string | null }) {
  const router = useRouter();
  const initial = splitPhone(phone);

  const [dialCode, setDialCode] = useState(initial.dialCode);
  // Grouped once, for the stored number only -- NOT re-grouped on every
  // keystroke, which fights the caret on iOS.
  const [local, setLocal] = useState(groupDigits(initial.local));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const ccId = useId();
  const localId = useId();

  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  const unchanged = dialCode === initial.dialCode && digits === initial.local;

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor={localId}>Broj telefona</Label>

        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-xl border bg-transparent transition-colors focus-within:ring-3 dark:bg-input/30",
            error
              ? "border-destructive focus-within:ring-destructive/20"
              : "border-input focus-within:border-ring focus-within:ring-ring/50"
          )}
        >
          <div className="relative flex shrink-0 items-center">
            <select
              id={ccId}
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value)}
              aria-label="Pozivni broj države"
              // 16px text (`text-base`): anything smaller makes iOS Safari zoom
              // the page in on focus and never zoom back out.
              className="h-12 appearance-none bg-transparent pl-3.5 pr-8 text-base text-foreground outline-none"
            >
              {DIAL_CODES.map((country) => (
                <option key={`${country.code} ${country.name}`} value={country.code}>
                  {country.flag} {country.code}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
              aria-hidden={true}
            />
          </div>

          <span className="my-2.5 w-px shrink-0 bg-border" aria-hidden={true} />

          <input
            id={localId}
            name="phone_local"
            type="tel"
            inputMode="numeric"
            placeholder="60 063 7486"
            autoComplete="tel-national"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={local}
            // Digits and spaces only; the action strips everything but the
            // digits anyway when it builds the E.164 value.
            onChange={(e) => setLocal(e.target.value.replace(/[^\d\s]/g, ""))}
            aria-invalid={error ? true : undefined}
            className="h-12 w-full min-w-0 bg-transparent px-3.5 text-base tracking-[0.01em] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* `normalizePhone` drops spaces and the national trunk zero, so
            "060 063 7486" is stored as "+381600637486". Showing exactly what
            lands in the profile removes the surprise. */}
        <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
          {digits ? (
            <>
              Sačuvaćemo:{" "}
              <span className="font-medium text-foreground">
                {dialCode}
                {digits}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Broj čuvamo samo da bismo mogli da te kontaktiramo — ne koristi se za
        prijavu i ne šaljemo ti SMS.
      </p>

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

      <Button
        type="submit"
        disabled={pending || saved || unchanged}
        className="h-12 rounded-xl text-base"
      >
        {pending ? "Čuvam…" : "Sačuvaj broj"}
      </Button>
    </form>
  );
}

/** Digits grouped in threes -- "600637486" reads as "600 637 486". Used once,
 * on the number loaded from the profile, so a 9-digit run isn't a wall. */
function groupDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");
}
