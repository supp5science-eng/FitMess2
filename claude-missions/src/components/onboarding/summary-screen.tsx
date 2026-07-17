"use client";

import { useMemo, useState, useTransition } from "react";

import { saveOnboardingAction } from "@/app/(app)/onboarding/pregled/actions";
import { FieldError } from "@/components/onboarding/field-error";
import { NumberField } from "@/components/onboarding/number-field";
import { OptionGroup } from "@/components/onboarding/option-group";
import { Button } from "@/components/ui/button";
import { computeBudgetSummary, explainGoalAdjustment } from "@/lib/onboarding/summary";
import type { CompleteOnboardingData } from "@/lib/onboarding/summary";
import { isOnboardingDataComplete } from "@/lib/onboarding/summary";
import { ACTIVITY_LEVEL_OPTIONS } from "@/lib/onboarding/types";
import type { OnboardingData, Sex } from "@/lib/onboarding/types";
import {
  validateActivityLevel,
  validateAge,
  validateGoal,
  validateHeight,
  validateSex,
  validateWeight,
} from "@/lib/onboarding/validation";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Žensko" },
  { value: "male", label: "Muško" },
];

/**
 * F016: the editable onboarding summary (AS-020, AS-030, AS-031).
 *
 * `initialData` arrives already-complete from the server component
 * (`/onboarding/pregled/page.tsx` renders the empty state instead of this
 * component when the query-string hand-off is incomplete), but every field
 * still lives in ordinary nullable `OnboardingData` client state here --
 * the same shape/validators F015's wizard uses -- so clearing a field while
 * editing degrades to an inline Serbian error rather than a crash, exactly
 * like the wizard's own per-step validation.
 *
 * AS-020's "editing a value ... recomputes the budget live" is a plain
 * `useMemo` over `data`: every keystroke/selection re-derives the whole
 * budget summary through the same `computeBudgetSummary` (F014 engine)
 * call the server-rendered initial view used, so there is exactly one code
 * path for "turn these inputs into a budget", never a UI-side shortcut.
 */
export function SummaryScreen({
  initialData,
}: {
  initialData: CompleteOnboardingData;
}) {
  const [data, setData] = useState<OnboardingData>(initialData);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaveError(undefined);
  }

  const fieldErrors = useMemo(() => {
    const sexResult = validateSex(data.sex);
    const ageResult = validateAge(data.ageYears);
    const heightResult = validateHeight(data.heightCm);
    const weightResult = validateWeight(data.weightKg);
    const activityResult = validateActivityLevel(data.activityLevel);
    const goalResult = validateGoal(
      data.targetWeightKg,
      data.timeframeWeeks,
      data.weightKg
    );

    return {
      sex: sexResult.valid ? undefined : sexResult.error,
      age: ageResult.valid ? undefined : ageResult.error,
      height: heightResult.valid ? undefined : heightResult.error,
      weight: weightResult.valid ? undefined : weightResult.error,
      activity: activityResult.valid ? undefined : activityResult.error,
      goal: goalResult.valid ? undefined : goalResult.error,
    };
  }, [data]);

  const isValid = Object.values(fieldErrors).every((error) => !error);

  // Recomputed on every render where `data` changed -- this IS the AS-020
  // "recomputes the budget live before saving" behaviour.
  const summary = useMemo(() => {
    if (!isValid || !isOnboardingDataComplete(data)) return null;
    return computeBudgetSummary(data);
  }, [data, isValid]);

  const adjustmentMessages = useMemo(() => {
    if (!summary || !summary.goal.adjusted || data.sex === null) return [];
    return explainGoalAdjustment(summary.goal.reasonCodes, data.sex);
  }, [summary, data.sex]);

  function handleSave() {
    if (!isValid) {
      setSaveError(
        "Proveri unete podatke -- neko polje nije popunjeno ispravno."
      );
      return;
    }
    setSaveError(undefined);
    startTransition(async () => {
      const result = await saveOnboardingAction(data);
      // A successful save calls `redirect("/danas")` inside the server
      // action -- Next's client runtime turns that into a navigation
      // without this callback ever seeing a return value. Only the
      // failure path returns here.
      if (result && !result.ok) {
        setSaveError(result.error_sr);
      }
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tvoj plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Ovo je tvoj dnevni budžet na osnovu unetih podataka. Izmeni bilo
          šta ispod i plan će se automatski osvežiti.
        </p>
      </div>

      {summary ? (
        <section
          data-testid="budget-summary"
          className="flex flex-col items-center gap-2 rounded-xl border border-border bg-accent/40 px-6 py-6 text-center"
        >
          <p className="text-sm font-medium text-muted-foreground">
            Dnevni kalorijski budžet
          </p>
          <p
            className="text-5xl font-bold text-primary"
            data-testid="daily-kcal"
          >
            {summary.dailyKcal}
          </p>
          <p className="text-sm text-muted-foreground">kcal dnevno</p>
          <p className="text-base text-foreground" data-testid="weekly-kcal">
            {summary.weeklyKcal} kcal nedeljno
          </p>

          <div className="mt-4 grid w-full grid-cols-3 gap-3">
            <div className="flex flex-col items-center rounded-lg bg-background px-2 py-3">
              <span
                className="text-lg font-semibold text-foreground"
                data-testid="protein-g"
              >
                {summary.macros.proteinG}g
              </span>
              <span className="text-xs text-muted-foreground">Proteini</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-background px-2 py-3">
              <span
                className="text-lg font-semibold text-foreground"
                data-testid="fat-g"
              >
                {summary.macros.fatG}g
              </span>
              <span className="text-xs text-muted-foreground">Masti</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-background px-2 py-3">
              <span
                className="text-lg font-semibold text-foreground"
                data-testid="carbs-g"
              >
                {summary.macros.carbsG}g
              </span>
              <span className="text-xs text-muted-foreground">UH</span>
            </div>
          </div>
        </section>
      ) : (
        <p
          role="status"
          data-testid="summary-unavailable"
          className="text-sm text-muted-foreground"
        >
          Popuni podatke ispod ispravno da vidiš svoj plan.
        </p>
      )}

      {adjustmentMessages.length > 0 ? (
        <div
          role="status"
          data-testid="goal-adjustment-notice"
          className="rounded-lg border border-primary/30 bg-accent/30 px-4 py-3 text-sm"
        >
          <p className="font-medium text-foreground">
            Prilagodili smo tvoj cilj
          </p>
          {adjustmentMessages.map((message) => (
            <p key={message} className="mt-1 text-muted-foreground">
              {message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">
          Tvoji podaci
        </h2>

        <div className="flex flex-col gap-1.5">
          <OptionGroup
            legend="Pol"
            options={SEX_OPTIONS}
            value={data.sex}
            onChange={(value) => update("sex", value)}
          />
          <FieldError message={fieldErrors.sex} />
        </div>

        <NumberField
          id="pregled-godine"
          label="Godine"
          value={data.ageYears}
          onChange={(value) => update("ageYears", value)}
          error={fieldErrors.age}
        />
        <NumberField
          id="pregled-visina"
          label="Visina"
          suffix="cm"
          value={data.heightCm}
          onChange={(value) => update("heightCm", value)}
          error={fieldErrors.height}
        />
        <NumberField
          id="pregled-tezina"
          label="Težina"
          suffix="kg"
          step={0.1}
          value={data.weightKg}
          onChange={(value) => update("weightKg", value)}
          error={fieldErrors.weight}
        />

        <div className="flex flex-col gap-1.5">
          <OptionGroup
            legend="Nivo aktivnosti"
            options={ACTIVITY_LEVEL_OPTIONS}
            value={data.activityLevel}
            onChange={(value) => update("activityLevel", value)}
          />
          <FieldError message={fieldErrors.activity} />
        </div>

        <NumberField
          id="pregled-ciljna-tezina"
          label="Ciljna težina"
          suffix="kg"
          step={0.1}
          value={data.targetWeightKg}
          onChange={(value) => update("targetWeightKg", value)}
        />
        <NumberField
          id="pregled-nedelje"
          label="Rok"
          suffix="nedelja"
          value={data.timeframeWeeks}
          onChange={(value) => update("timeframeWeeks", value)}
        />
        <FieldError message={fieldErrors.goal} />
      </div>

      {saveError ? (
        <p role="alert" data-testid="save-error" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      <Button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-2"
      >
        {isPending ? "Čuvamo..." : "Započni"}
      </Button>
    </main>
  );
}
