"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DIAL_CODES, splitPhone } from "@/lib/auth/dial-codes";
import { cn } from "@/lib/utils";

import { changePhoneAction } from "./actions";

/**
 * "Broj telefona" edit form in Podešavanja.
 *
 * Built to look like the rest of Podešavanja, not like a web form: the field
 * is a `Card` cell (same `bg-card` surface and radius as every settings group)
 * split by a hairline into the dial code and the number, 56px tall like a
 * settings row, with the explanations as quiet footnotes underneath the way
 * iOS grouped lists do it. The earlier version -- a bare `<label>` over two
 * separately-boxed controls of different heights -- read as a stray form
 * dropped into the app.
 *
 * Not the auth.css-scoped `PhoneField` from signup: auth.css only loads inside
 * the `(auth)` layout. The country list is shared (`DIAL_CODES`) so the two
 * can't drift.
 *
 * PREFILLED with the number already on the profile: reaching this from settings
 * means "my number changed", not "I never gave one".
 */
export function PhoneForm({ phone }: { phone: string | null }) {
  const router = useRouter();
  const { t } = useT();
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
        setError(result.error_sr ?? t("profil.error.generic"));
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
      <section className="flex flex-col gap-2">
        {/* No visible field label: the page heading already says "Broj
            telefona", and repeating it above the only field is noise. */}
        <Card
          className={cn(
            "flex items-stretch overflow-hidden rounded-xl transition-colors focus-within:ring-3",
            error
              ? "border-destructive focus-within:ring-destructive/20"
              : "focus-within:border-ring focus-within:ring-ring/50"
          )}
        >
          <div className="relative flex shrink-0 items-center">
            <select
              id={ccId}
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value)}
              aria-label={t("profil.phone.dialAria")}
              // 16px text (`text-base`): anything smaller makes iOS Safari zoom
              // the page in on focus and never zoom back out.
              className="h-14 appearance-none bg-transparent pl-4 pr-8 text-base text-foreground outline-none"
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

          <span className="my-3 w-px shrink-0 bg-border" aria-hidden={true} />

          <input
            id={localId}
            name="phone_local"
            aria-label={t("settings.phone")}
            type="tel"
            inputMode="numeric"
            placeholder="60 123 4567"
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
            className="h-14 w-full min-w-0 bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </Card>

        {/* Footnotes under the group, iOS-style. `normalizePhone` drops spaces
            and the national trunk zero, so "060 063 7486" is stored as
            "+381600637486" -- better seen before saving than after. */}
        <div className="flex flex-col gap-1 px-1">
          <p className="min-h-4 text-xs text-muted-foreground" aria-live="polite">
            {digits ? (
              <>
                {t("profil.phone.willSave")}{" "}
                <span className="font-medium text-foreground">
                  {dialCode}
                  {digits}
                </span>
              </>
            ) : null}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("profil.phone.note")}
          </p>
        </div>
      </section>

      {error ? (
        <p role="alert" className="px-1 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="px-1 text-sm font-medium text-primary">
          {t("profil.phone.saved")}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || saved || unchanged}
        className="h-12 rounded-xl text-base"
      >
        {pending ? t("profil.saving") : t("profil.phone.submit")}
      </Button>
    </form>
  );
}

/**
 * Groups the stored digits the way a phone number is actually read: the last
 * four together, then threes, working from the RIGHT. "600637486" becomes
 * "60 063 7486" -- which is how a Serbian mobile number (06X XXX XXXX, minus
 * the trunk zero we strip) looks to its owner. Grouping from the left instead
 * produced "600 637 486", which reads like somebody else's number.
 *
 * Applied once, to the number loaded from the profile -- never on keystroke,
 * which fights the caret on iOS.
 */
function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return digits;

  const tail = digits.slice(-4);
  const head = digits.slice(0, -4);
  const groups: string[] = [];
  for (let end = head.length; end > 0; end -= 3) {
    groups.unshift(head.slice(Math.max(0, end - 3), end));
  }
  return [...groups, tail].join(" ");
}
