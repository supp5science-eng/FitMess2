"use client";

import { SelectField, rangeInclusive } from "@/components/onboarding/select-field";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "@/lib/onboarding/validation";

const WEIGHT_OPTIONS = rangeInclusive(MIN_WEIGHT_KG, MAX_WEIGHT_KG);

/** F015 step 4 (težina) -- AS-019: collects current weight in kilograms via a
 * native wheel/select (iOS renders its system picker). */
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
          Izaberi težinu u kilogramima -- ovo je tvoja polazna tačka.
        </p>
      </div>
      <SelectField
        id="tezina"
        label="Težina"
        suffix="kg"
        value={value}
        onChange={onChange}
        options={WEIGHT_OPTIONS}
        placeholder="Izaberi težinu"
        error={error}
        autoFocus
      />
    </div>
  );
}
