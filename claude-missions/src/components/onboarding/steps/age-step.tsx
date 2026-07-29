"use client";

import { useT } from "@/components/i18n/locale-provider";
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
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("onboarding.age.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("onboarding.age.subtitle")}
        </p>
      </div>
      <DateOfBirthPicker
        id="godine"
        label={t("onboarding.age.label")}
        value={value}
        onChange={onChange}
        error={error}
      />
    </div>
  );
}
