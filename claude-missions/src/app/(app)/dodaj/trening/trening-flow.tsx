"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Flame, Minus, Plus, Trash2 } from "lucide-react";

import type { MiniWeekDay } from "@/components/home/mini-week-bars";
import { StepsCard } from "@/components/home/steps-card";
import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FALLBACK_STEP_GOAL } from "@/lib/steps/step-goal";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  MAX_WORKOUT_MINUTES,
  MIN_WORKOUT_MINUTES,
  WORKOUT_ACTIVITIES,
  WORKOUT_INTENSITIES,
  findActivity,
  workoutKcal,
  totalWorkoutKcal,
  totalWorkoutMinutes,
  type WorkoutActivity,
} from "@/lib/workout/activities";
import type { Workout, WorkoutIntensity } from "@/lib/types/db";
import { cn } from "@/lib/utils";

import { deleteWorkoutAction, logWorkoutAction } from "./actions";

// Trening — "write down what you did, see what it cost".
//
// Two states, no wizard: pick an activity from the grid, then set minutes and
// intensity on one screen with the burn updating live above the button. The
// preview is computed with the SAME pure function the server action stores
// with (`workoutKcal`), so the number never changes between choosing and
// saving.
//
// The breakdown at the foot ("mirovanje + trening = ukupno") is the whole
// reason a burn figure is allowed on this screen at all: it frames the number
// as TOTAL EXPENDITURE, which is a fact about the day, rather than as spare
// allowance, which it is not. `trening.note.plan` states that outright. If a
// future change makes this screen touch `targets`, it will be double-counting
// the multiplier the plan already applies -- see `src/lib/workout/activities.ts`.

/** Minute stepper granularity. Sessions are remembered in fives, not ones. */
const MINUTE_STEP = 5;

/** `1830` -> `"1.830"` (Serbian thousands separator), same as the steps card. */
function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function TreningFlow({
  dayKey,
  initialWorkouts = [],
  weightKg = null,
  restingKcal = null,
  initialSteps = 0,
  stepsGoal = FALLBACK_STEP_GOAL,
  stepsWeek = [],
}: {
  /** Belgrade calendar day these sessions belong to (today). */
  dayKey: string;
  initialWorkouts?: Workout[];
  /** `profiles.weight_kg` -- what the burn is priced against. The server
   * re-reads it on save; this copy only drives the live preview. */
  weightKg?: number | null;
  /** The user's BMR: the resting half of the breakdown. Null on a profile
   * without height/birth year -- the total line is then left out rather than
   * invented. */
  restingKcal?: number | null;
  /** Koraci, which moved onto this screen on 2026-08-01 when its card left the
   * home screen (see `page.tsx`). Today's total, the user's own goal, and the
   * 7-day strip -- the same `StepsCard` as before, unchanged. */
  initialSteps?: number;
  stepsGoal?: number;
  stepsWeek?: MiniWeekDay[];
}) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  const [workouts, setWorkouts] = useState<Workout[]>(initialWorkouts);
  const [activity, setActivity] = useState<WorkoutActivity | null>(null);
  const [intensity, setIntensity] = useState<WorkoutIntensity>("srednje");
  const [minutes, setMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function pickActivity(next: WorkoutActivity) {
    setActivity(next);
    setMinutes(next.defaultMinutes);
    setIntensity("srednje");
    setError(null);
  }

  function clearActivity() {
    setActivity(null);
    setError(null);
  }

  function bumpMinutes(delta: number) {
    setMinutes((current) =>
      Math.min(
        MAX_WORKOUT_MINUTES,
        Math.max(MIN_WORKOUT_MINUTES, current + delta)
      )
    );
  }

  function onMinutesInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    if (digits === "") {
      setMinutes(MIN_WORKOUT_MINUTES);
      return;
    }
    setMinutes(
      Math.min(MAX_WORKOUT_MINUTES, Math.max(MIN_WORKOUT_MINUTES, Number(digits)))
    );
  }

  // The live preview. Same inputs, same function, same result as the save.
  const previewKcal = activity
    ? workoutKcal({
        activityKey: activity.key,
        intensity,
        minutes,
        weightKg,
      })
    : 0;

  function save() {
    if (!activity || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await logWorkoutAction({
        activityKey: activity.key,
        intensity,
        minutes,
        day: dayKey,
      });

      if (!result.ok) {
        setError(result.error_sr || t("trening.saveFailed"));
        return;
      }

      // Fold the saved row in locally instead of navigating: logging a second
      // session ("teretana, pa šetnja kući") is common enough that bouncing to
      // /danas after the first one would make the second a whole round trip.
      setWorkouts((current) => [...current, result.workout]);
      setActivity(null);
    });
  }

  function remove(workoutId: string) {
    if (isPending) return;
    setError(null);
    setDeletingId(workoutId);

    startTransition(async () => {
      const result = await deleteWorkoutAction(workoutId);
      setDeletingId(null);

      if (!result.ok) {
        setError(result.error_sr || t("trening.deleteFailed"));
        return;
      }

      setWorkouts((current) =>
        current.filter((workout) => workout.id !== workoutId)
      );
    });
  }

  const trainingKcal = totalWorkoutKcal(workouts);
  const trainingMinutes = totalWorkoutMinutes(workouts);
  const totalKcal = restingKcal !== null ? restingKcal + trainingKcal : null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("trening.title")}
        </h1>
        <Link
          href="/danas"
          data-testid="trening-cancel"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("dodaj.cancel")}
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          data-testid="trening-error"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {activity === null ? (
        /* Step one: what did you do. A plain grid -- every option visible,
           nothing behind a search box, because naming a sport is something the
           user does from memory in one tap. */
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("trening.pick")}
          </h2>
          <div
            data-testid="trening-activity-grid"
            className="grid grid-cols-2 gap-2.5"
          >
            {WORKOUT_ACTIVITIES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => pickActivity(option)}
                data-testid={`trening-activity-${option.key}`}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {option.emoji}
                </span>
                <span className="text-sm font-medium leading-tight text-foreground">
                  {t(option.labelKey as MessageKey)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        /* Step two: how long and how hard, with the burn live above the save
           button. */
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="flex items-center gap-3">
              <span className="text-2xl leading-none" aria-hidden="true">
                {activity.emoji}
              </span>
              <span
                data-testid="trening-selected"
                className="text-base font-semibold text-foreground"
              >
                {t(activity.labelKey as MessageKey)}
              </span>
            </span>
            <button
              type="button"
              onClick={clearActivity}
              data-testid="trening-change"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("trening.change")}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("trening.howLong")}
            </h2>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => bumpMinutes(-MINUTE_STEP)}
                disabled={minutes <= MIN_WORKOUT_MINUTES}
                aria-label={t("trening.minusAria", { n: MINUTE_STEP })}
                data-testid="trening-minutes-minus"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40 active:translate-y-px"
              >
                <Minus className="size-5" aria-hidden="true" />
              </button>

              <div className="flex items-baseline justify-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={t("trening.inputAria")}
                  data-testid="trening-minutes-input"
                  value={String(minutes)}
                  onChange={(event) => onMinutesInput(event.target.value)}
                  size={Math.max(1, String(minutes).length)}
                  className="min-w-0 border-0 bg-transparent p-0 text-center text-4xl font-bold text-foreground tabular-nums outline-none focus:outline-none"
                />
                <span className="text-lg font-medium text-muted-foreground">
                  {t("trening.minutes")}
                </span>
              </div>

              <button
                type="button"
                onClick={() => bumpMinutes(MINUTE_STEP)}
                disabled={minutes >= MAX_WORKOUT_MINUTES}
                aria-label={t("trening.plusAria", { n: MINUTE_STEP })}
                data-testid="trening-minutes-plus"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-40 active:translate-y-px"
              >
                <Plus className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("trening.howHard")}
            </h2>
            {/* Described by how it FELT, not by heart-rate zones: "can I still
                talk" is the one gauge everybody can answer honestly without
                equipment, and it maps cleanly onto the three MET columns. */}
            <div className="grid grid-cols-3 gap-2.5">
              {WORKOUT_INTENSITIES.map((level) => {
                const isActive = level === intensity;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setIntensity(level)}
                    aria-pressed={isActive}
                    data-testid={`trening-intensity-${level}`}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors active:translate-y-px",
                      isActive
                        ? "border-primary/60 bg-primary/15"
                        : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {t(`workout.intensity.${level}` as MessageKey)}
                    </span>
                    <span className="text-[0.7rem] leading-tight text-muted-foreground">
                      {t(
                        `workout.intensity.${level}Desc` as MessageKey
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <p
              data-testid="trening-preview-kcal"
              className="text-center text-2xl font-bold text-foreground tabular-nums"
            >
              {t("trening.burn", { kcal: formatNumber(previewKcal) })}
            </p>
            <Button
              type="button"
              onClick={save}
              disabled={isPending}
              data-testid="trening-save"
              className="h-12 w-full text-base"
            >
              {isPending ? t("trening.saving") : t("trening.save")}
            </Button>
          </div>
        </section>
      )}

      {/* Today's sessions + the breakdown. Always visible, under whichever step
          is showing: the point of the screen is the day, not the one entry. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("trening.today")}
        </h2>

        {workouts.length === 0 ? (
          <p
            data-testid="trening-empty"
            className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground"
          >
            {t("trening.empty")}
          </p>
        ) : (
          <ul data-testid="trening-list" className="flex flex-col gap-2">
            {workouts.map((workout) => {
              const known = findActivity(workout.activity_key);
              const label = known
                ? t(known.labelKey as MessageKey)
                : t("workout.activity.unknown");

              return (
                <li
                  key={workout.id}
                  data-testid={`trening-item-${workout.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-xl leading-none" aria-hidden="true">
                    {known?.emoji ?? "🏅"}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("trening.sessionLine", {
                        minutes: workout.minutes,
                        intensity: t(
                          `workout.intensity.${workout.intensity}` as MessageKey
                        ),
                      })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {formatNumber(workout.kcal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(workout.id)}
                    disabled={isPending}
                    aria-label={t("trening.deleteAria", { activity: label })}
                    data-testid={`trening-delete-${workout.id}`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    {deletingId === workout.id ? (
                      <span className="text-xs">…</span>
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* The breakdown. Resting is shown FIRST and largest in the sum because
            it is the bigger number by far -- seeing that the body spends most
            of its energy doing nothing is the context that keeps a 400 kcal
            session in proportion. */}
        {workouts.length > 0 ? (
          <div
            data-testid="trening-breakdown"
            className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Flame className="size-4 text-orange-500" aria-hidden="true" />
              {t("trening.spent")}
            </span>

            {restingKcal !== null ? (
              <span className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("trening.resting")}</span>
                <span className="tabular-nums">
                  {formatNumber(restingKcal)}
                </span>
              </span>
            ) : null}

            <span className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("trening.fromTraining")}</span>
              <span className="tabular-nums">
                +{formatNumber(trainingKcal)}
              </span>
            </span>

            {totalKcal !== null ? (
              <span className="flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>{t("trening.total")}</span>
                <span data-testid="trening-total" className="tabular-nums">
                  {formatNumber(totalKcal)}
                </span>
              </span>
            ) : null}

            <span className="text-xs text-muted-foreground">
              {t("trening.totalMinutes", { minutes: trainingMinutes })}
            </span>
          </div>
        ) : null}

        {/* Koraci. Sits under the day's sessions because it answers the same
            question in a different unit: a workout is the movement you set out
            to do, steps are the movement the day happened to contain. Its own
            card, its own sheet, its own goal -- nothing about it changed when
            it moved here from the home screen. */}
        <StepsCard
          dayKey={dayKey}
          initialSteps={initialSteps}
          goal={stepsGoal}
          week={stepsWeek}
          className="pt-1"
        />

        <p
          data-testid="trening-note-plan"
          className="rounded-2xl bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground"
        >
          {t("trening.note.plan")}
        </p>
        <p className="px-1 text-[0.7rem] leading-relaxed text-muted-foreground">
          {t("trening.note.estimate")}
        </p>
      </section>
    </main>
  );
}
