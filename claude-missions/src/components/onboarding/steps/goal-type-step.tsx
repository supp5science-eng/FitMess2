"use client";

import type { GoalType } from "@/lib/types/db";
import { FieldError } from "@/components/onboarding/field-error";
import { OptionGroup } from "@/components/onboarding/option-group";

const GOAL_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  {
    value: "lose",
    label: "Mršavljenje",
    description: "Skini kilograme uz kontrolisan kalorijski deficit.",
  },
  {
    value: "maintain",
    label: "Održavanje",
    description: "Zadrži trenutnu težinu i navike.",
  },
  {
    value: "gain",
    label: "Gojenje",
    description: "Dobij na masi uz kalorijski višak.",
  },
  {
    value: "tone",
    label: "Zategnutost",
    description: "Zategni se — mišić uz zadržavanje težine.",
  },
];

/** Onboarding step: the user's overall objective. Drives the calorie math
 * (`planForGoal`) and whether the target-weight step is shown next. */
export function GoalTypeStep({
  value,
  onChange,
  error,
}: {
  value: GoalType | null;
  onChange: (value: GoalType) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Koji ti je cilj?
        </h2>
        <p className="text-sm text-muted-foreground">
          Po ovome računamo tvoj dnevni unos i prilagođavamo plan.
        </p>
      </div>
      <OptionGroup
        legend="Cilj"
        options={GOAL_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <FieldError message={error} />
    </div>
  );
}
