"use client";

import { FieldError } from "@/components/onboarding/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_NAME_LENGTH } from "@/lib/onboarding/validation";

/**
 * Onboarding step "ime" -- collects the user's name, shown right after the
 * "pol" step. A plain labeled text input (same `Input`/`Label`/`FieldError`
 * building blocks the numeric steps use), wired to its inline Serbian error
 * for assistive tech (`aria-invalid`/`aria-describedby`).
 */
export function NameStep({
  value,
  onChange,
  error,
}: {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = "ime-error";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kako se zoveš?
        </h2>
        <p className="text-sm text-muted-foreground">
          Koristimo tvoje ime da ti se obraćamo u aplikaciji.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ime">Ime</Label>
        <Input
          id="ime"
          name="ime"
          type="text"
          placeholder="Tvoje ime"
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          value={value ?? ""}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-xl px-4 text-lg md:text-lg"
        />
        <FieldError message={error} id={errorId} />
      </div>
    </div>
  );
}
