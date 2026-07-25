"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Flame, Pencil } from "lucide-react";

import {
  regenerateRulesAction,
  toggleHabitAction,
  updateRulesAction,
} from "@/app/(app)/profil/pravila/actions";
import { DayStructureGuidance } from "@/components/profil/day-structure-guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateRuleText } from "@/lib/budget/rules";
import type { PersistedRule } from "@/lib/budget/rules";
import { todayProgress } from "@/lib/habits/streak";
import type { HabitProgress } from "@/lib/habits/streak";
import { cn } from "@/lib/utils";

const GENERIC_SAVE_ERROR_SR =
  "Nešto nije uspelo pri čuvanju. Proveri konekciju i pokušaj ponovo.";

/**
 * `/profil/pravila` — "Navike".
 *
 * This screen used to be a list of generated eating rules with an on/off
 * switch that had no consequence anywhere in the app: nothing ever read the
 * rules back, so toggling one changed nothing and the whole page read as
 * decoration. Turning them into habits is what gives the switch a job.
 *
 * The two interactions are deliberately separated, because they answer
 * different questions and one of them happens every day:
 *
 *  - TOP (daily): tap a habit row to check it off for today. The whole row is
 *    the target -- no small switch to hit -- and each row carries its streak
 *    and the last 7 days as dots, so the reward for a run is visible at the
 *    moment you extend it.
 *  - BOTTOM ("Podesi navike", collapsed by default): which habits you track
 *    at all, and their wording. This is where the switches live now; they are
 *    a rare, deliberate action, not a daily one.
 *
 * State: server-rendered props seed local state, every tap updates it
 * immediately (the UI never waits on the network) and a `useTransition`-wrapped
 * server action persists it; a failed write reverts the optimistic change and
 * shows an inline Serbian retry message rather than leaving the screen out of
 * sync with the database.
 */
export function HabitsScreen({
  initialHabits,
  initialRules,
  dailyKcal,
}: {
  initialHabits: HabitProgress[];
  initialRules: PersistedRule[];
  dailyKcal: number | null;
}) {
  const [habits, setHabits] = useState<HabitProgress[]>(initialHabits);
  const [rules, setRules] = useState<PersistedRule[]>(initialRules);
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [, startTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();

  const tracked = habits.filter((habit) => habit.enabled);
  const progress = todayProgress(habits);

  // --- daily check-off ----------------------------------------------------

  /** Apply a check/uncheck locally. The streak moves by exactly one because
   * `currentStreak` counts today only when it's done (and already counts
   * through yesterday when it isn't) -- so there is no re-derivation to do
   * here beyond the +-1. */
  function applyToggle(habitId: string, done: boolean): HabitProgress[] {
    return habits.map((habit) =>
      habit.id === habitId
        ? {
            ...habit,
            doneToday: done,
            streak: Math.max(0, habit.streak + (done ? 1 : -1)),
            recentDays: habit.recentDays.map((day, index) =>
              index === habit.recentDays.length - 1 ? { ...day, done } : day
            ),
          }
        : habit
    );
  }

  function handleCheck(habit: HabitProgress) {
    const previousHabits = habits;
    const done = !habit.doneToday;
    setHabits(applyToggle(habit.id, done));
    setSaveError(undefined);

    startTransition(async () => {
      const result = await toggleHabitAction(habit.id, done);
      if (!result.ok) {
        setHabits(previousHabits);
        setSaveError(result.error_sr || GENERIC_SAVE_ERROR_SR);
      }
    });
  }

  // --- settings (which habits, and their wording) -------------------------

  function persistRules(
    nextRules: PersistedRule[],
    previousRules: PersistedRule[],
    previousHabits: HabitProgress[]
  ) {
    setSaveError(undefined);
    startTransition(async () => {
      const result = await updateRulesAction(nextRules);
      if (!result.ok) {
        setRules(previousRules);
        setHabits(previousHabits);
        setSaveError(result.error_sr || GENERIC_SAVE_ERROR_SR);
      }
    });
  }

  function handleTrackToggle(id: string) {
    const previousRules = rules;
    const previousHabits = habits;
    const nextRules = rules.map((rule) =>
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    );
    setRules(nextRules);
    setHabits(
      habits.map((habit) =>
        habit.id === id ? { ...habit, enabled: !habit.enabled } : habit
      )
    );
    persistRules(nextRules, previousRules, previousHabits);
  }

  function startEditing(rule: PersistedRule) {
    setEditingId(rule.id);
    setEditText(rule.textSr);
    setEditError(undefined);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditText("");
    setEditError(undefined);
  }

  function saveEdit(id: string) {
    const validation = validateRuleText(editText);
    if (!validation.valid) {
      setEditError(validation.error);
      return;
    }

    const previousRules = rules;
    const previousHabits = habits;
    const trimmed = editText.trim();
    const nextRules = rules.map((rule) =>
      rule.id === id ? { ...rule, textSr: trimmed } : rule
    );
    setRules(nextRules);
    setHabits(
      habits.map((habit) =>
        habit.id === id ? { ...habit, textSr: trimmed } : habit
      )
    );
    setEditingId(null);
    setEditError(undefined);
    persistRules(nextRules, previousRules, previousHabits);
  }

  function handleRegenerate() {
    setSaveError(undefined);
    startRegenerateTransition(async () => {
      const result = await regenerateRulesAction();
      if (!result.ok) {
        setSaveError(result.error_sr || GENERIC_SAVE_ERROR_SR);
        return;
      }

      setRules(result.rules);
      // Fresh habits have no history yet on this screen -- the next server
      // render fills in any check-offs a returning habit already had.
      setHabits(
        result.rules.map((rule) => ({
          id: rule.id,
          textSr: rule.textSr,
          enabled: rule.enabled,
          doneToday: false,
          streak: 0,
          doneInHistory: 0,
          recentDays: initialHabits[0]?.recentDays.map((day) => ({
            dayKey: day.dayKey,
            done: false,
          })) ?? [],
        }))
      );
    });
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8">
      {/* Every other Podešavanja sub-page carries this; without it the only
          way off this screen was to close the app (there is no browser chrome
          in an installed PWA). */}
      <Link
        href="/profil"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden={true} />
        Podešavanja
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Navike
          </h1>
          <p className="text-sm text-muted-foreground">
            Male stvari koje se sabiraju. Čekiraj šta si danas uradio.
          </p>
        </div>
        {progress.total > 0 ? (
          <span
            data-testid="habits-today-progress"
            className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
          >
            {progress.done}/{progress.total}
          </span>
        ) : null}
      </div>

      {tracked.length === 0 ? (
        <div
          role="status"
          data-testid="habits-empty-state"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            {rules.length === 0
              ? "Još uvek nemaš navike."
              : "Ne pratiš nijednu naviku. Uključi ih u „Podesi navike“ ispod."}
          </p>
          {rules.length === 0 ? (
            <Button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? "Pravimo..." : "Predloži mi navike"}
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="habits-list">
          {tracked.map((habit) => (
            <li key={habit.id}>
              {/* The whole row is the tap target: checking a habit off is the
                  daily action, so it must be impossible to miss. */}
              <button
                type="button"
                onClick={() => handleCheck(habit)}
                data-testid={`habit-check-${habit.id}`}
                aria-pressed={habit.doneToday}
                aria-label={`${habit.textSr} — ${
                  habit.doneToday ? "urađeno danas" : "nije urađeno danas"
                }`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  habit.doneToday
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <span
                  aria-hidden={true}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    habit.doneToday
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent"
                  )}
                >
                  <Check className="size-4" strokeWidth={3} />
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      habit.doneToday ? "text-foreground" : "text-foreground"
                    )}
                  >
                    {habit.textSr}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {habit.recentDays.map((day) => (
                      <span
                        key={day.dayKey}
                        aria-hidden={true}
                        className={cn(
                          "size-1.5 rounded-full",
                          day.done ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    ))}
                    <span className="ml-1 text-[0.7rem] text-muted-foreground">
                      {habit.doneInHistory} od 30 dana
                    </span>
                  </span>
                </span>

                {habit.streak > 0 ? (
                  <span
                    data-testid={`habit-streak-${habit.id}`}
                    className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary"
                  >
                    <Flame className="size-4" aria-hidden={true} />
                    {habit.streak}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {saveError ? (
        <p role="alert" data-testid="save-error" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {/* Settings: rare, deliberate changes -- collapsed so the daily screen
          stays a list of habits, not a control panel. */}
      {rules.length > 0 ? (
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowSettings((open) => !open)}
            data-testid="habits-settings-toggle"
            aria-expanded={showSettings}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-medium text-foreground"
          >
            Podesi navike
            <span className="text-xs font-normal text-muted-foreground">
              {showSettings ? "Sakrij" : "Prikaži"}
            </span>
          </button>

          {showSettings ? (
            <div
              className="flex flex-col gap-3"
              data-testid="habits-settings-panel"
            >
              <p className="text-xs text-muted-foreground">
                Isključena navika se ne prikazuje gore, a istorija joj ostaje
                sačuvana.
              </p>

              <ul className="flex flex-col gap-2">
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    data-testid={`habit-setting-${rule.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3"
                  >
                    {editingId === rule.id ? (
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor={`habit-edit-${rule.id}`}
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Izmeni tekst navike
                        </label>
                        <Input
                          id={`habit-edit-${rule.id}`}
                          value={editText}
                          onChange={(event) => setEditText(event.target.value)}
                          aria-invalid={Boolean(editError)}
                          aria-describedby={
                            editError ? `habit-edit-error-${rule.id}` : undefined
                          }
                        />
                        {editError ? (
                          <p
                            id={`habit-edit-error-${rule.id}`}
                            role="alert"
                            className="text-sm font-medium text-destructive"
                          >
                            {editError}
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(rule.id)}
                          >
                            Sačuvaj
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                          >
                            Otkaži
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            rule.enabled
                              ? "text-foreground"
                              : "text-muted-foreground"
                          )}
                          data-testid={`habit-text-${rule.id}`}
                        >
                          {rule.textSr}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditing(rule)}
                          aria-label={`Izmeni tekst: ${rule.textSr}`}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <Pencil className="size-4" aria-hidden={true} />
                        </button>
                        {/* Bigger than the old 44x24 switch, never disabled
                            mid-save (a switch that freezes while the network
                            catches up reads as broken), and the knob travel
                            matches the track so it lands flush. */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={rule.enabled}
                          aria-label={`Prati naviku: ${rule.textSr}`}
                          data-testid={`habit-toggle-${rule.id}`}
                          onClick={() => handleTrackToggle(rule.id)}
                          className={cn(
                            "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
                            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                              rule.enabled ? "translate-x-5" : "translate-x-0.5"
                            )}
                          />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="self-start"
              >
                {isRegenerating ? "Pravimo..." : "Predloži nove navike"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {dailyKcal !== null ? <DayStructureGuidance dailyKcal={dailyKcal} /> : null}
    </main>
  );
}
