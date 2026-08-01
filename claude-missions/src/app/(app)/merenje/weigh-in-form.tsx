"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Nedeljno merenje: the weigh-in itself.
 *
 * One number and one instruction. The instruction is not decoration -- morning,
 * after the toilet, before eating, undressed is what makes two readings a week
 * apart comparable at all. Without it the 1-2 kg of daily water/sodium/glycogen
 * swing swamps the ~0.5 kg of real weekly change the plan is being judged on,
 * and the whole feature measures noise.
 *
 * Re-weighing on the same day REPLACES the reading (the API upserts on
 * `(user_id, day)`), so a mistyped number is fixed by typing it again rather
 * than by leaving a bad point in the trend for a week.
 */
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
  const inputId = useId();

  const [value, setValue] = useState(
    initialWeightKg != null ? String(initialWeightKg).replace(".", ",") : ""
  );
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;

    // Serbian keyboards produce a comma; the API wants a number.
    const weightKg = Number(value.replace(",", "."));
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Label htmlFor={inputId}>{t("merenje.field")}</Label>
        <Input
          id={inputId}
          // `decimal` rather than `numeric`: iOS shows the comma key, which is
          // the separator a Serbian user will reach for.
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("merenje.placeholder")}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          data-testid="weigh-in-input"
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

        <Button type="submit" disabled={pending || value.trim() === ""}>
          {pending ? t("merenje.saving") : t("merenje.save")}
        </Button>
      </form>
    </Card>
  );
}
