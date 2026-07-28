"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";

import type { MealPlan, MealSlotPlan } from "@/lib/plan/plan";
import type { ScaledMeal } from "@/lib/plan/healthy-meals";
import { cn } from "@/lib/utils";

// "Šta da jedeš danas" (2026-07-28): the detail screen at /predlog, opened from
// the compact reminder on /danas (mirrors the streak -> /dostignuca pattern).
//
// The plan (which meals, their targets, done-state, and the ranked healthy
// suggestions) is computed server-side by `computeMealPlan` and handed in whole.
// This client component owns only the interactions: cycling "Promeni" through a
// slot's ranked suggestions, and posting "Dodaj u dnevnik" to /api/plan/log
// (which re-derives the macros from the catalog, so the diary can't be fed
// arbitrary numbers). Every alternative is still a curated healthy meal.

export function MealPlanScreen({ plan }: { plan: MealPlan }) {
  const router = useRouter();

  // One swap index per slot -- which ranked suggestion is currently shown.
  const [swap, setSwap] = useState<number[]>(() => plan.slots.map(() => 0));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remainingProteinG = Math.max(
    0,
    plan.proteinTargetG - plan.proteinConsumedG
  );
  const proteinPct =
    plan.proteinTargetG > 0
      ? Math.min(100, Math.round((plan.proteinConsumedG / plan.proteinTargetG) * 100))
      : 0;

  const allDone = plan.mealsDone >= plan.suggestedCount;

  function cycle(slotIndex: number, count: number) {
    setSwap((prev) => {
      const next = [...prev];
      next[slotIndex] = (next[slotIndex]! + 1) % Math.max(1, count);
      return next;
    });
  }

  async function addToDiary(slot: MealSlotPlan, meal: ScaledMeal) {
    setError(null);
    setSavingId(meal.templateId);
    try {
      const res = await fetch("/api/plan/log", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: meal.templateId,
          targetKcal: slot.targetKcal,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error_sr?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error_sr ?? "Nismo uspeli da sačuvamo unos. Pokušaj ponovo.");
        setSavingId(null);
        return;
      }
      // Land back on /danas so the ring, macros and progress are fresh (the
      // App Router re-reads this dynamic page's server data on navigation).
      router.push("/danas");
      router.refresh();
    } catch {
      setError("Nismo uspeli da sačuvamo unos. Pokušaj ponovo.");
      setSavingId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/danas"
          aria-label="Nazad"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted active:translate-y-px"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Šta da jedeš danas
        </h1>
      </header>

      <p className="text-sm text-muted-foreground">
        {plan.suggestedCount === 1 ? (
          <>
            U prilogu je <b className="font-semibold text-foreground">sugestija za 1 obrok</b>{" "}
            danas — <b className="font-semibold text-foreground">ostalo biraš</b> šta hoćeš, dok si
            ispod plafona.
          </>
        ) : (
          <>
            U prilogu su <b className="font-semibold text-foreground">sugestije za 2 obroka</b>{" "}
            danas — <b className="font-semibold text-foreground">treći biraš</b> šta hoćeš, dok si
            ispod plafona.
          </>
        )}
      </p>

      {/* progress strip: meals covered + protein */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Predloženo
          </span>
          <span className="text-xl font-bold tabular-nums text-foreground">
            {plan.mealsDone}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              / {plan.suggestedCount}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Protein</span>
            <span className="font-semibold tabular-nums text-foreground">
              {plan.proteinConsumedG} / {plan.proteinTargetG} g
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${proteinPct}%`,
                backgroundColor: "var(--macro-protein)",
              }}
            />
          </div>
        </div>
      </div>

      {allDone ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-4 text-sm text-foreground">
          Oba predložena obroka su pokrivena — protein ti je danas obezbeđen. Za
          ostatak dana jedi šta hoćeš, samo ostani ispod plafona. 👌
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* one block per suggested meal */}
      <div className="flex flex-col gap-3.5">
        {plan.slots.map((slot, index) => {
          if (slot.done) {
            return <DoneRow key={slot.slot + index} slot={slot} />;
          }
          const list = slot.suggestions;
          const meal = list[swap[index]! % Math.max(1, list.length)] ?? list[0];
          if (!meal) return null;
          return (
            <SuggestionCard
              key={slot.slot + index}
              slot={slot}
              meal={meal}
              hasAlternatives={list.length > 1}
              remainingProteinG={remainingProteinG}
              saving={savingId === meal.templateId}
              onSwap={() => cycle(index, list.length)}
              onAdd={() => addToDiary(slot, meal)}
            />
          );
        })}
      </div>

      {/* the free third meal */}
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-card px-4 py-3.5"
        style={{ borderColor: "color-mix(in oklab, var(--chart-5) 45%, var(--border))" }}
      >
        <div>
          <div className="text-sm font-semibold text-foreground">
            {plan.suggestedCount === 1 ? "Ostali obroci — biraš sam" : "Treći obrok — biraš sam"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            jedi šta hoćeš, samo ostani ispod plafona
          </div>
        </div>
        <div className="whitespace-nowrap text-lg font-extrabold tabular-nums text-[var(--chart-5)]">
          ~{plan.freeRoomKcal.toLocaleString("sr-RS")} kcal
        </div>
      </div>
    </main>
  );
}

function DoneRow({ slot }: { slot: MealSlotPlan }) {
  return (
    <div className="grid grid-cols-[26px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span
        className="flex size-[26px] items-center justify-center rounded-full text-[var(--brand)]"
        style={{ backgroundColor: "color-mix(in oklab, var(--brand) 16%, transparent)" }}
        aria-hidden="true"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Obrok {slot.order} · {slot.labelSr.toLowerCase()}
        </div>
        <div className="mt-0.5 text-sm font-medium text-foreground">Pokriveno</div>
      </div>
      <span className="text-xs text-muted-foreground">≥ {slot.targetProteinG} g P</span>
    </div>
  );
}

function SuggestionCard({
  slot,
  meal,
  hasAlternatives,
  remainingProteinG,
  saving,
  onSwap,
  onAdd,
}: {
  slot: MealSlotPlan;
  meal: ScaledMeal;
  hasAlternatives: boolean;
  remainingProteinG: number;
  saving: boolean;
  onSwap: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card"
      style={{ borderColor: "color-mix(in oklab, var(--brand) 40%, var(--border))" }}
    >
      <div
        className="px-4 pb-3 pt-3.5"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--brand) 10%, var(--card)), transparent)",
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">
          Obrok {slot.order} · {slot.labelSr.toLowerCase()}
        </div>
        <div className="mt-1 text-lg font-bold leading-tight tracking-tight text-foreground text-balance">
          {meal.nameSr}
        </div>
      </div>

      <ul className="flex flex-col px-4">
        {meal.items.map((item) => (
          <li
            key={item.nameSr}
            className="flex items-baseline justify-between border-b border-border py-2.5 text-sm last:border-b-0"
          >
            <span className="text-foreground">{item.nameSr}</span>
            <span className="tabular-nums text-[13px] text-muted-foreground">
              {item.grams} g
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 px-4 pb-1 pt-3">
        <MacroChip color="var(--macro-protein)" label="P" value={`${meal.macros.proteinG} g`} />
        <MacroChip color="var(--macro-carbs)" label="UH" value={`${meal.macros.carbsG} g`} />
        <MacroChip color="var(--macro-fat)" label="M" value={`${meal.macros.fatG} g`} />
        <span className="ml-auto self-center text-[12.5px] font-semibold tabular-nums text-foreground">
          {meal.macros.kcal} kcal
        </span>
      </div>

      <div
        className="mx-4 mt-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] text-foreground"
        style={{ borderLeftWidth: "3px", borderLeftColor: "var(--brand)" }}
      >
        <b className="text-[var(--brand)]">Zašto ovo?</b>{" "}
        {remainingProteinG > 0 ? (
          <>
            Proteina ti je danas ostalo ~{remainingProteinG} g — ovaj obrok nosi ~
            {meal.macros.proteinG} g, pa ti pokriva dobar deo, a ostaje ti budžeta za treći
            obrok.
          </>
        ) : (
          <>
            Protein ti je već skoro pokriven — ovaj obrok ga zaokružuje uz malo povrća i vlakana.
          </>
        )}
      </div>

      <div className="flex gap-2.5 px-4 pb-2 pt-3.5">
        <button
          type="button"
          onClick={onAdd}
          disabled={saving}
          className="flex-[1.4] rounded-xl bg-[var(--brand)] px-3 py-3 text-sm font-semibold text-[#06231d] transition-opacity active:translate-y-px disabled:opacity-60"
        >
          {saving ? "Čuvam…" : "Dodaj u dnevnik"}
        </button>
        <button
          type="button"
          onClick={onSwap}
          disabled={!hasAlternatives}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold text-foreground transition-colors active:translate-y-px",
            hasAlternatives ? "hover:bg-muted" : "opacity-50"
          )}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Promeni
        </button>
      </div>
      <div className="px-4 pb-4 pt-1 text-xs text-muted-foreground">
        Ne odgovara ti? „Promeni” daje drugu — jednako zdravu — opciju.
      </div>
    </div>
  );
}

function MacroChip({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1.5 text-[12.5px] font-medium">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {label} <b className="font-bold tabular-nums">{value}</b>
    </span>
  );
}
