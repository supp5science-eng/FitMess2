"use client";

import { DateOfBirthPicker } from "@/components/onboarding/date-of-birth-picker";

/** F015 step 2 (godine) -- AS-019: collects an exact date of birth via three
 * inline scroll wheels and derives whole-year age for the model. */
export function AgeStep({
  value,
  onChange,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Kada si rođen/a?
        </h2>
        <p className="text-sm text-muted-foreground">
          Datum rođenja ulazi u računicu tvog dnevnog cilja kalorija.
        </p>
      </div>
      <DateOfBirthPicker
        id="godine"
        label="Godine"
        value={value}
        onChange={onChange}
        error={error}
      />
    </div>
  );
}
