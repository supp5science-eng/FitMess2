"use client";

import { RulerPicker } from "@/components/onboarding/ruler-picker";
import { rangeInclusive } from "@/components/onboarding/select-field";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "@/lib/onboarding/validation";

const WEIGHT_OPTIONS = rangeInclusive(MIN_WEIGHT_KG, MAX_WEIGHT_KG);

/** F015 step 4 (težina) -- AS-019: collects current weight in kilograms via an
 * inline ruler picker. */
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
          Ovo je tvoja polazna tačka.
        </p>
      </div>
      <RulerPicker
        id="tezina"
        label="Težina"
        caption="Trenutna težina"
        value={value}
        onChange={onChange}
        options={WEIGHT_OPTIONS}
        renderReadout={(v) => `${v} kg`}
        error={error}
      />
    </div>
  );
}
