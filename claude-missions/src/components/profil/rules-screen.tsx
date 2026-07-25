"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { updateRulesAction, regenerateRulesAction } from "@/app/(app)/profil/pravila/actions";
import { DayStructureGuidance } from "@/components/profil/day-structure-guidance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateRuleText } from "@/lib/budget/rules";
import type { PersistedRule } from "@/lib/budget/rules";
import { cn } from "@/lib/utils";

const GENERIC_SAVE_ERROR_SR =
  "Nešto nije uspelo pri čuvanju. Proveri konekciju i pokušaj ponovo.";

/**
 * F017 / AS-029: `/profil/pravila` -- lets the user toggle each generated
 * eating rule on/off and edit its text, persisting every change.
 *
 * "Server as source of truth; small client state (form/optimistic) only"
 * (clarified data-shape answer): `rules` starts from the server-rendered
 * `initialRules` prop and every toggle/edit updates this local state
 * immediately (so the UI never feels laggy), then a `useTransition`-wrapped
 * server-action call persists the whole array. A failed save reverts the
 * optimistic change and shows an inline Serbian retry message rather than
 * leaving the UI silently out of sync with the database (failure-handling
 * clarified answer).
 */
export function RulesScreen({
  initialRules,
  dailyKcal,
}: {
  initialRules: PersistedRule[];
  dailyKcal: number | null;
}) {
  const [rules, setRules] = useState<PersistedRule[]>(initialRules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, startRegenerateTransition] = useTransition();

  function persist(nextRules: PersistedRule[], previousRules: PersistedRule[]) {
    setSaveError(undefined);
    startTransition(async () => {
      const result = await updateRulesAction(nextRules);
      if (!result.ok) {
        setRules(previousRules);
        setSaveError(result.error_sr || GENERIC_SAVE_ERROR_SR);
      }
    });
  }

  function handleToggle(id: string) {
    const previousRules = rules;
    const nextRules = rules.map((rule) =>
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    );
    setRules(nextRules);
    persist(nextRules, previousRules);
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
    const nextRules = rules.map((rule) =>
      rule.id === id ? { ...rule, textSr: editText.trim() } : rule
    );
    setRules(nextRules);
    setEditingId(null);
    setEditError(undefined);
    persist(nextRules, previousRules);
  }

  function handleRegenerate() {
    setSaveError(undefined);
    startRegenerateTransition(async () => {
      const result = await regenerateRulesAction();
      if (result.ok) {
        setRules(result.rules);
      } else {
        setSaveError(result.error_sr || GENERIC_SAVE_ERROR_SR);
      }
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

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tvoja pravila ishrane
        </h1>
        <p className="text-sm text-muted-foreground">
          Uključi ili isključi pravilo, ili izmeni tekst da ti više odgovara.
        </p>
      </div>

      {rules.length === 0 ? (
        <div
          role="status"
          data-testid="rules-empty-state"
          className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Još uvek nemaš generisana pravila ishrane.
          </p>
          <Button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? "Generišemo..." : "Generiši pravila"}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="rules-list">
          {rules.map((rule) => (
            <li
              key={rule.id}
              data-testid={`rule-row-${rule.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3"
            >
              {editingId === rule.id ? (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`rule-edit-${rule.id}`}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Izmeni tekst pravila
                  </label>
                  <Input
                    id={`rule-edit-${rule.id}`}
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    aria-invalid={Boolean(editError)}
                    aria-describedby={
                      editError ? `rule-edit-error-${rule.id}` : undefined
                    }
                  />
                  {editError ? (
                    <p
                      id={`rule-edit-error-${rule.id}`}
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
                      disabled={isPending}
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
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      rule.enabled
                        ? "text-foreground"
                        : "text-muted-foreground line-through"
                    )}
                    data-testid={`rule-text-${rule.id}`}
                  >
                    {rule.textSr}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(rule)}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      Uredi
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`Uključi ili isključi: ${rule.textSr}`}
                      data-testid={`rule-toggle-${rule.id}`}
                      onClick={() => handleToggle(rule.id)}
                      disabled={isPending}
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        rule.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform",
                          rule.enabled ? "translate-x-5" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {rules.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="self-start"
        >
          {isRegenerating ? "Generišemo..." : "Generiši ponovo"}
        </Button>
      ) : null}

      {saveError ? (
        <p role="alert" data-testid="save-error" className="text-sm text-destructive">
          {saveError}
        </p>
      ) : null}

      {dailyKcal !== null ? <DayStructureGuidance dailyKcal={dailyKcal} /> : null}
    </main>
  );
}
