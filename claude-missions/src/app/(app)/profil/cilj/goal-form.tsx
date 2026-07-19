"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { macroTargets, planForGoal } from "@/lib/budget/engine";
import type { GoalType, Sex } from "@/lib/types/db";

import { saveGoalAction } from "./actions";

const GOAL_OPTIONS: { value: GoalType; label: string; description: string }[] = [
  { value: "lose", label: "Smršaj", description: "Kontrolisan kalorijski deficit." },
  { value: "tone", label: "Zategni se", description: "Blagi deficit za čvrstu liniju." },
  { value: "gain", label: "Nabaci mišiće", description: "Kalorijski višak za čistu masu." },
  { value: "maintain", label: "Održavanje", description: "Zadrži trenutnu težinu." },
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
        setError(result.error_sr ?? "Nešto nije uspelo. Pokušaj ponovo.");
        return;
      }
      setSaved(true);
      setTimeout(() => router.push("/analitika"), 900);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Cilj</Label>
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
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isWeightChange ? (
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ciljna-tezina">Ciljna težina (kg)</Label>
            <Input
              id="ciljna-tezina"
              type="number"
              inputMode="decimal"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              placeholder={goal === "gain" ? "npr. 85" : "npr. 75"}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="rok">Rok (nedelja)</Label>
            <Input
              id="rok"
              type="number"
              inputMode="numeric"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              placeholder="npr. 12"
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Novi dnevni plan
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
              P {preview.proteinG} · UH {preview.carbsG} · M {preview.fatG} g
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Unesi ciljnu težinu i rok da vidiš novi plan.
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
          Cilj je sačuvan. Plan je preračunat.
        </p>
      ) : null}

      <Button type="submit" disabled={pending || saved || !canPreview}>
        {pending ? "Čuvam…" : "Sačuvaj cilj"}
      </Button>
    </form>
  );
}
