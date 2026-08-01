"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { RulerPicker } from "@/components/onboarding/ruler-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Nedeljno merenje: the weigh-in itself.
 *
 * One number and one instruction. The instruction is not decoration -- morning,
 * after the toilet, before eating, undressed is what makes two readings a week
 * apart comparable at all. Without it the 1-2 kg of daily water/sodium/glycogen
 * swing swamps the ~0.5 kg of real weekly change the plan is being judged on,
 * and the whole feature measures noise.
 *
 * The number goes in on the same ruler the questionnaire uses (`RulerPicker`),
 * not a text box. Two reasons beyond consistency: a keyboard on this screen is
 * a keyboard between a person and a ten-second task, and every value the ruler
 * can produce is already valid, so the range error below is a guard rather than
 * something a user can walk into.
 *
 * Re-weighing on the same day REPLACES the reading (the API upserts on
 * `(user_id, day)`), so a mistyped number is fixed by scrolling again rather
 * than by leaving a bad point in the trend for a week.
 */

/**
 * 0.1 kg. NOT whole kilograms, which is where the questionnaire's ruler sits.
 *
 * The questionnaire wants a starting point; this wants a measurement. The trend
 * engine judges the plan on roughly half a kilogram of change per week, so a
 * 1 kg step would quantise away most of the signal it exists to read -- and it
 * would do it invisibly, as a plan correction that never fires.
 */
const STEP_KG = 0.1;
const MIN_KG = 30;
const MAX_KG = 300;

/**
 * How far either side of the last known weight the ruler reaches.
 *
 * A ruler over the whole 30-300 kg range at 0.1 steps is 2.700 ticks nobody
 * can scroll to the end of. Anchoring it to the weight already on file keeps
 * it a few flicks wide, which is all a weekly reading ever needs to move.
 */
const RANGE_KG = 20;

/** Weight when there is nothing on file at all -- effectively unreachable for
 * an onboarded user, since the questionnaire always asks. */
const FALLBACK_KG = 80;

/** Kills the float drift that would otherwise make `indexOf` miss (30 + 3*0.1
 * is 30.300000000000004, which is not a value in the options list). */
function round1(kg: number): number {
  return Math.round(kg * 10) / 10;
}

function buildOptions(center: number): number[] {
  const from = Math.max(MIN_KG, round1(center - RANGE_KG));
  const to = Math.min(MAX_KG, round1(center + RANGE_KG));
  const count = Math.round((to - from) / STEP_KG) + 1;
  return Array.from({ length: count }, (_, i) => round1(from + i * STEP_KG));
}
export function WeighInForm({
  todayKey,
  initialWeightKg,
}: {
  todayKey: string;
  /** Today's weigh-in if there already is one, else the profile weight. */
  initialWeightKg: number | null;
}) {
  const router = useRouter();
  const { t } = useT();

  const center = round1(initialWeightKg ?? FALLBACK_KG);
  const options = useMemo(() => buildOptions(center), [center]);

  // Starts on the weight already on file: this is someone confirming a number
  // they just read off a display, so the ruler opens next to it rather than at
  // an arbitrary point they have to travel from.
  const [value, setValue] = useState<number | null>(center);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    const weightKg = value;
    if (weightKg === null || weightKg < MIN_KG || weightKg > MAX_KG) {
      setError(t("merenje.error.range"));
      return;
    }

    setPending(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/merenje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: todayKey, weightKg }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error_sr?: string;
      };

      if (!response.ok || !payload.ok) {
        setError(payload.error_sr ?? t("merenje.error.generic"));
        return;
      }

      setSaved(true);
      // The verdict is computed on the server from stored data, so the result
      // card below only appears once this refresh brings it back -- there is no
      // client-side copy of the trend to get out of sync with the database.
      router.refresh();
    } catch {
      setError(t("merenje.error.generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info
          className="size-4 shrink-0 translate-y-0.5 text-primary"
          aria-hidden={true}
        />
        <span>
          <span className="font-medium text-foreground">
            {t("merenje.howTo")}
          </span>{" "}
          {t("merenje.howToWhy")}
        </span>
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
        data-testid="weigh-in-input"
      >
        <RulerPicker
          id="tezina-merenje"
          label={t("merenje.field")}
          caption={t("merenje.readout")}
          value={value}
          onChange={(next) => {
            setValue(next);
            setSaved(false);
          }}
          options={options}
          // Serbian decimal comma, and always one decimal place -- "85 kg" and
          // "85,0 kg" flickering into each other as the ruler moves reads as a
          // glitch.
          renderReadout={(kg) => `${kg.toFixed(1).replace(".", ",")} kg`}
        />

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {saved && !error ? (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <Check className="size-4" aria-hidden={true} />
            {t("merenje.saved")}
          </p>
        ) : null}

        <Button type="submit" disabled={pending || value === null}>
          {pending ? t("merenje.saving") : t("merenje.save")}
        </Button>
      </form>
    </Card>
  );
}
