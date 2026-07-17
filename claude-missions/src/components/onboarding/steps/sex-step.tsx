"use client";

import type { Sex } from "@/lib/types/db";
import { FieldError } from "@/components/onboarding/field-error";
import { OptionGroup } from "@/components/onboarding/option-group";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Žensko" },
  { value: "male", label: "Muško" },
];

/** F015 step 1 (pol) -- AS-019: collects sex. */
export function SexStep({
  value,
  onChange,
  error,
}: {
  value: Sex | null;
  onChange: (value: Sex) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koji je tvoj pol?
        </h2>
        <p className="text-sm text-muted-foreground">
          Ovo nam pomaže da tačnije izračunamo tvoje potrebe za kalorijama.
        </p>
      </div>
      <OptionGroup
        legend="Pol"
        options={SEX_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}
