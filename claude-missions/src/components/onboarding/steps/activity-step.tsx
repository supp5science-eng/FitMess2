"use client";

import type { ActivityLevel } from "@/lib/types/db";
import { ACTIVITY_LEVEL_OPTIONS } from "@/lib/onboarding/types";
import { FieldError } from "@/components/onboarding/field-error";
import { OptionGroup } from "@/components/onboarding/option-group";

/** F015 step 5 (nivo aktivnosti) -- AS-019: collects one of 5 activity tiers. */
export function ActivityStep({
  value,
  onChange,
  error,
}: {
  value: ActivityLevel | null;
  onChange: (value: ActivityLevel) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koliko si aktivan/aktivna?
        </h2>
        <p className="text-sm text-muted-foreground">
          Izaberi opciju koja najbolje opisuje tvoju nedelju.
        </p>
      </div>
      <OptionGroup
        legend="Nivo aktivnosti"
        options={ACTIVITY_LEVEL_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}
