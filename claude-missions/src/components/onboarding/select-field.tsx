"use client";

import { ChevronDown } from "lucide-react";

import { FieldError } from "@/components/onboarding/field-error";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Inclusive list of integers `min..max` (step 1) for the option list. */
export function rangeInclusive(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * A labeled numeric picker built on a plain native `<select>`. This is
 * deliberate: on iOS a `<select>` opens the system rotating wheel
 * (`UIPickerView`) with zero custom scroll code, so it can never "jump out of
 * its lane" — the OS owns the spinner, we only style the closed control to
 * match the app's dark inputs. On desktop it's an ordinary dropdown.
 *
 * Controlled like `NumberField`: `value` is the selected number (or null for
 * "nothing chosen", which shows the placeholder and fails validation upstream).
 */
export function SelectField({
  id,
  label,
  suffix,
  value,
  onChange,
  options,
  placeholder = "Izaberi",
  error,
  autoFocus,
}: {
  id: string;
  label: string;
  suffix?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: number[];
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
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
      <div className="relative">
        <select
          id={id}
          name={id}
          autoFocus={autoFocus}
          value={value === null ? "" : String(value)}
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
          className={cn(
            "h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent pl-3 pr-9 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
            value === null && "text-muted-foreground"
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {suffix ? `${option} ${suffix}` : option}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <FieldError message={error} id={errorId} />
    </div>
  );
}
