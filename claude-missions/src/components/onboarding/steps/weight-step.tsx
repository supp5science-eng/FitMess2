"use client";

import { NumberField } from "@/components/onboarding/number-field";

/** F015 step 4 (težina) -- AS-019: collects current weight in kilograms via a
 * simple numeric field. */
export function WeightStep({
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
          Kolika je tvoja trenutna težina?
        </h2>
        <p className="text-sm text-muted-foreground">
          Unesi težinu u kilogramima -- ovo je tvoja polazna tačka.
        </p>
      </div>
      <NumberField
        id="tezina"
        label="Težina"
        suffix="kg"
        value={value}
        onChange={onChange}
        error={error}
        autoFocus
        step={0.1}
      />
    </div>
  );
}
