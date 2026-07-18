"use client";

import { NumberField } from "@/components/onboarding/number-field";

/** F015 step 2 (godine) -- AS-019: collects age in whole years via a simple
 * numeric field. */
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
          Koliko imaš godina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Godine su deo formule za tvoj dnevni cilj kalorija.
        </p>
      </div>
      <NumberField
        id="godine"
        label="Godine"
        value={value}
        onChange={onChange}
        error={error}
        autoFocus
      />
    </div>
  );
}
