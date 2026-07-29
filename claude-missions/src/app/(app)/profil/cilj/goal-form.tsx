"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { macroTargets, planForGoal } from "@/lib/budget/engine";
import type { MessageKey } from "@/lib/i18n/messages";
import type { GoalType, Sex } from "@/lib/types/db";

import { saveGoalAction } from "./actions";

const GOAL_OPTIONS: {
  value: GoalType;
  labelKey: MessageKey;
  descKey: MessageKey;
}[] = [
  { value: "lose", labelKey: "profil.goal.lose.label", descKey: "profil.goal.lose.desc" },
  { value: "tone", labelKey: "profil.goal.tone.label", descKey: "profil.goal.tone.desc" },
  { value: "gain", labelKey: "profil.goal.gain.label", descKey: "profil.goal.gain.desc" },
  { value: "maintain", labelKey: "profil.goal.maintain.label", descKey: "profil.goal.maintain.desc" },
];

export function GoalForm({
  sex,
  currentWeightKg,
  tdeeKcal,
  initialGoal,
  initialTargetWeightKg,
  initialTimeframeWeeks,
}: {
  sex: Sex;
  currentWeightKg: number;
  tdeeKcal: number;
  initialGoal: GoalType;
  initialTargetWeightKg: number | null;
  initialTimeframeWeeks: number | null;
}) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [goal, setGoal] = useState<GoalType>(initialGoal);
  const [targetWeight, setTargetWeight] = useState(
    initialTargetWeightKg?.toString() ?? ""
  );
  const [timeframe, setTimeframe] = useState(
    initialTimeframeWeeks?.toString() ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isWeightChange = goal === "lose" || goal === "gain";
  const targetNum = targetWeight === "" ? null : Number(targetWeight);
  const weeksNum = timeframe === "" ? null : Number(timeframe);

  const canPreview =
    !isWeightChange ||
    (targetNum !== null &&
      !Number.isNaN(targetNum) &&
      weeksNum !== null &&
      !Number.isNaN(weeksNum) &&
      weeksNum > 0 &&
      ((goal === "gain" && targetNum > currentWeightKg) ||
        (goal === "lose" && targetNum < currentWeightKg)));

  let preview: { dailyKcal: number; proteinG: number; carbsG: number; fatG: number } | null =
    null;
  if (canPreview) {
    const plan = planForGoal({
      goal,
      sex,
      currentWeightKg,
      targetWeightKg: isWeightChange ? targetNum : null,
      timeframeWeeks: isWeightChange ? weeksNum : null,
      tdeeKcal,
    });
    const macros = macroTargets(currentWeightKg, plan.dailyKcal);
    preview = {
      dailyKcal: plan.dailyKcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
    };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveGoalAction({
        goal,
        targetWeightKg: isWeightChange ? targetNum : null,
        timeframeWeeks: isWeightChange ? weeksNum : null,
      });
      if (!result.ok) {
        setError(result.error_sr ?? t("profil.error.generic"));
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/analitika"), 900);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>{t("profil.goal.fieldLabel")}</Label>
        <div className="flex flex-col gap-2">
          {GOAL_OPTIONS.map((option) => {
            const active = goal === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setGoal(option.value)}
                aria-pressed={active}
                className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/60"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    active ? "text-primary" : "text-foreground"
                  }`}
                >
                  {t(option.labelKey)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(option.descKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isWeightChange ? (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ciljna-tezina">{t("profil.goal.targetWeight")}</Label>
            <Input
              id="ciljna-tezina"
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder={goal === "gain" ? t("profil.goal.egGain") : t("profil.goal.egLose")}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="rok">{t("profil.goal.timeframe")}</Label>
            <Input
              id="rok"
              type="number"
              inputMode="numeric"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder={t("profil.goal.timeframePlaceholder")}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("profil.goal.newPlan")}
        </p>
        {preview ? (
          <>
            <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">
              {preview.dailyKcal.toLocaleString("sr-RS")}{" "}
              <span className="text-base font-medium text-muted-foreground">
                kcal
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("profil.goal.macroLine", {
                protein: preview.proteinG,
                carbs: preview.carbsG,
                fat: preview.fatG,
              })}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {t("profil.goal.previewHint")}
          </p>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm font-medium text-primary">
          {t("profil.goal.saved")}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || saved || !canPreview}>
        {pending ? t("profil.saving") : t("profil.saveGoal")}
      </Button>
    </form>
  );
}
