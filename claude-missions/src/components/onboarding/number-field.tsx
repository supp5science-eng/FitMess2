"use client";

import { FieldError } from "@/components/onboarding/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * F015: shared labeled numeric input for the godine/visina/težina/cilj
 * steps -- `type="number"` + `inputMode="decimal"` gives mobile devices the
 * numeric keypad; `aria-invalid`/`aria-describedby` wire the input to its
 * inline Serbian error for assistive tech (AS-128 / clarified accessibility
 * answer).
 */
export function NumberField({
  id,
  label,
  suffix,
  value,
  onChange,
  error,
  autoFocus,
  step,
}: {
  id: string;
  label: string;
  suffix?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  autoFocus?: boolean;
  step?: number;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {suffix ? (
          <span className="text-muted-foreground">({suffix})</span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        autoFocus={autoFocus}
        value={value === null ? "" : value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? null : parsed);
        }}
      />
      <FieldError message={error} id={errorId} />
    </div>
  );
}
