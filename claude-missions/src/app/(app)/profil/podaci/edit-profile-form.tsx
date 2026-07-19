"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { FieldError } from "@/components/onboarding/field-error";
import {
  rangeInclusive,
  SelectField,
} from "@/components/onboarding/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTIVITY_LEVEL_OPTIONS,
  type ActivityLevel,
  type Sex,
} from "@/lib/onboarding/types";
import {
  MAX_AGE_YEARS,
  MAX_HEIGHT_CM,
  MAX_WEIGHT_KG,
  MIN_AGE_YEARS,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
} from "@/lib/onboarding/validation";
import { cn } from "@/lib/utils";

import { saveProfileDataAction } from "./actions";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Žensko" },
  { value: "male", label: "Muško" },
];

type Initial = {
  name: string | null;
  sex: Sex | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: ActivityLevel | null;
};

export function EditProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial.name ?? "");
  const [sex, setSex] = useState<Sex | null>(initial.sex);
  const [ageYears, setAgeYears] = useState<number | null>(initial.ageYears);
  const [heightCm, setHeightCm] = useState<number | null>(initial.heightCm);
  const [weightKg, setWeightKg] = useState<number | null>(initial.weightKg);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    initial.activityLevel
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveProfileDataAction({
        name: name.trim() === "" ? null : name,
        sex,
        ageYears,
        heightCm,
        weightKg,
        activityLevel,
      });

      if (!result.ok) {
        setError(result.error_sr);
        return;
      }

      setSaved(true);
      // The daily budget was recomputed server-side; refresh so a return to
      // /danas (and this page) reflects the new numbers.
      router.refresh();
      router.push("/profil");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ime">Ime</Label>
        <Input
          id="ime"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="given-name"
          maxLength={60}
          placeholder="Tvoje ime"
        />
      </div>

      <ChoiceField
        label="Pol"
        value={sex}
        onChange={setSex}
        options={SEX_OPTIONS}
      />

      <SelectField
        id="godine"
        label="Godine"
        value={ageYears}
        onChange={setAgeYears}
        options={rangeInclusive(MIN_AGE_YEARS, MAX_AGE_YEARS)}
      />

      <SelectField
        id="visina"
        label="Visina"
        suffix="cm"
        value={heightCm}
        onChange={setHeightCm}
        options={rangeInclusive(MIN_HEIGHT_CM, MAX_HEIGHT_CM)}
      />

      <SelectField
        id="tezina"
        label="Težina"
        suffix="kg"
        value={weightKg}
        onChange={setWeightKg}
        options={rangeInclusive(MIN_WEIGHT_KG, MAX_WEIGHT_KG)}
      />

      <ChoiceField
        label="Nivo aktivnosti"
        value={activityLevel}
        onChange={setActivityLevel}
        options={ACTIVITY_LEVEL_OPTIONS}
      />

      {error ? (
        <FieldError message={error} id="edit-profile-error" />
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-primary">Sačuvano.</p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11">
        {pending ? "Čuvam…" : "Sačuvaj izmene"}
      </Button>
    </form>
  );
}

/**
 * A labeled string-choice picker built on a native `<select>` (same iOS-wheel
 * rationale as the numeric `SelectField`: the OS owns the spinner). Generic
 * over the value type so it serves both the Sex and ActivityLevel selects.
 */
function ChoiceField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly { value: T; label: string }[];
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : (event.target.value as T))
          }
          className={cn(
            "h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent pl-3 pr-9 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
            value === null && "text-muted-foreground"
          )}
        >
          <option value="" disabled>
            Izaberi
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
