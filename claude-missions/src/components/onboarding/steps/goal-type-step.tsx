"use client";

import type { GoalType } from "@/lib/types/db";
import { FieldError } from "@/components/onboarding/field-error";
import { OptionGroup } from "@/components/onboarding/option-group";

const GOAL_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  {
    value: "lose",
    label: "Smršaj",
    description: "Skini kilograme uz kontrolisan kalorijski deficit.",
  },
  {
    value: "tone",
    label: "Zategni se",
    description:
      "Blagi deficit da izgubiš salo i dobiješ čvrstu, zategnutu liniju.",
  },
  {
    value: "gain",
    label: "Nabaci mišiće",
    description:
      "Kalorijski višak da izgradiš čistu mišićnu masu i postaneš jači.",
  },
  {
    value: "maintain",
    label: "Održavanje",
    description: "Zadrži trenutnu težinu i navike.",
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
