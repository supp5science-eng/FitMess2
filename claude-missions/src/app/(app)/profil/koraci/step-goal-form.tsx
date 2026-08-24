"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Footprints } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  automaticStepGoal,
  stepGoalOptions,
  type StepGoalSuggestion,
} from "@/lib/steps/step-goal";
import { formatSteps } from "@/lib/steps/steps-week";
import type { ActivityLevel } from "@/lib/types/db";
import { cn } from "@/lib/utils";

import { saveStepGoalAction } from "./actions";

/**
 * "Cilj koraka" -- pick the automatic (activity-derived) goal or your own.
 *
 * Two cards, one choice, iOS-settings shaped. The automatic option SHOWS the
 * number it would use, because "automatski" on its own tells the user nothing;
 * the custom option opens a native `<select>` on the 500-step grid (an iOS
 * wheel, the same pattern the onboarding number fields use).
 */
export function StepGoalForm({
  activityLevel,
  activityLabel,
  initialCustomGoal,
  suggestion,
}: {
  activityLevel: ActivityLevel | null;
  /** Serbian label of the activity level, for the automatic card's subtitle. */
  activityLabel: string | null;
  /** `profiles.daily_step_goal`, or null when the goal is automatic. */
  initialCustomGoal: number | null;
  /** Derived from the user's OWN last 14 days -- null when too few days. */
  suggestion: StepGoalSuggestion | null;
}) {
  const router = useRouter();
  const { t } = useT();
  const automatic = automaticStepGoal(activityLevel);
  const options = stepGoalOptions();

  const [mode, setMode] = useState<"auto" | "custom">(
    initialCustomGoal == null ? "auto" : "custom"
  );
  const [customGoal, setCustomGoal] = useState(
    initialCustomGoal ?? suggestion?.suggestedGoal ?? automatic
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectId = useId();
  const chosen = mode === "auto" ? null : customGoal;
  const unchanged = chosen === initialCustomGoal;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveStepGoalAction({ goal: chosen });
      if (!result.ok) {
        setError(result.error_sr ?? t("profil.error.generic"));
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => router.push("/profil"), 900);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <ChoiceCard
          selected={mode === "auto"}
          onSelect={() => setMode("auto")}
          title={t("profil.steps.auto")}
          // Just the level, not a sentence about it: with the number on the
          // right, "Prema tvom nivou aktivnosti (umerena aktivnost)" wrapped to
          // two lines and pushed the figure off-centre.
          subtitle={activityLabel ?? t("profil.steps.autoSubtitle")}
          value={formatSteps(automatic)}
          testId="step-goal-auto"
        />

        <ChoiceCard
          selected={mode === "custom"}
          onSelect={() => setMode("custom")}
          title={t("profil.steps.custom")}
          subtitle={t("profil.steps.customSubtitle")}
          value={mode === "custom" ? formatSteps(customGoal) : null}
          testId="step-goal-custom"
        >
          {mode === "custom" ? (
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
              <div className="relative">
                <select
                  id={selectId}
                  aria-label={t("profil.steps.selectAria")}
                  value={customGoal}
                  onChange={(e) => setCustomGoal(Number(e.target.value))}
                  data-testid="step-goal-select"
                  // 16px text so iOS Safari doesn't zoom the page on focus.
                  className="h-12 w-full appearance-none rounded-xl border border-input bg-transparent pl-4 pr-10 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {t("profil.steps.optionLabel", { steps: formatSteps(option) })}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden={true}
                />
              </div>

              {/* Offered, never applied on its own: a goal that quietly follows
                  your average downward has stopped being a goal. */}
              {suggestion ? (
                <button
                  type="button"
                  onClick={() => setCustomGoal(suggestion.suggestedGoal)}
                  data-testid="step-goal-suggestion"
                  className="self-start text-left text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t("profil.steps.avgLabel", {
                    days: suggestion.basedOnDays,
                    dayWord:
                      suggestion.basedOnDays === 1
                        ? t("profil.steps.day")
                        : t("profil.steps.days"),
                  })}{" "}
                  <span className="font-medium text-foreground">
                    {formatSteps(suggestion.averageSteps)}
                  </span>
                  {t("profil.steps.suggestLabel")}{" "}
                  <span className="font-medium text-primary">
                    {formatSteps(suggestion.suggestedGoal)}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </ChoiceCard>
      </div>

      {error ? (
        <p role="alert" className="px-1 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="px-1 text-sm font-medium text-primary">
          {t("profil.steps.saved")}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || saved || unchanged}
        className="h-12 rounded-xl text-base"
      >
        {pending ? t("profil.saving") : t("profil.saveGoal")}
      </Button>
    </form>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  subtitle,
  value,
  testId,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  value: string | null;
  testId: string;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        selected ? "border-primary" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        data-testid={testId}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Footprints className="size-[18px]" aria-hidden={true} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {subtitle}
          </span>
        </span>

        {value ? (
          <span
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              selected ? "text-primary" : "text-muted-foreground"
            )}
          >
            {value}
          </span>
        ) : null}
      </button>
      {children}
    </Card>
  );
}
