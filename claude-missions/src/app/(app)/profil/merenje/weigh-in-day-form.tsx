"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_WEIGH_IN_TIME,
  WEIGH_IN_DAY_LABELS_SR,
} from "@/lib/weight/weigh-in-day";

import { saveWeighInDayAction } from "./actions";

/** Quarter-hour options through the morning and early afternoon -- a weigh-in
 * reminder at 22:15 would be asking for a reading nobody should take. */
const TIME_OPTIONS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
];

/**
 * "Dan merenja" -- pick the weekday, the time, and whether the phone should
 * bother you about it.
 *
 * Native `<select>`s on purpose: on iOS they open the system wheel, which is
 * the same control the onboarding number fields use, and it needs no custom
 * dropdown that would then have to be made accessible and themeable.
 */
export function WeighInDayForm({
  initialDay,
  initialTime,
  initialPushEnabled,
}: {
  initialDay: number;
  initialTime: string;
  initialPushEnabled: boolean;
}) {
  const router = useRouter();
  const { t } = useT();
  const dayId = useId();
  const timeId = useId();

  const [day, setDay] = useState(initialDay);
  const [time, setTime] = useState(
    TIME_OPTIONS.includes(initialTime) ? initialTime : DEFAULT_WEIGH_IN_TIME
  );
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const unchanged =
    day === initialDay &&
    time === initialTime &&
    pushEnabled === initialPushEnabled;

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveWeighInDayAction({
        weighInDay: day,
        weighInTime: time,
        pushEnabled,
      });

      if (!result.ok) {
        setError(result.error_sr ?? t("profil.error.generic"));
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={dayId}>{t("merenje.settings.day")}</Label>
        <select
          id={dayId}
          value={day}
          onChange={(event) => {
            setDay(Number(event.target.value));
            setSaved(false);
          }}
          className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          data-testid="weigh-in-day-select"
        >
          {WEIGH_IN_DAY_LABELS_SR.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-foreground">{t("merenje.settings.push")}</span>
        <input
          type="checkbox"
          checked={pushEnabled}
          onChange={(event) => {
            setPushEnabled(event.target.checked);
            setSaved(false);
          }}
          className="size-5 accent-primary"
          data-testid="weigh-in-push-toggle"
        />
      </label>

      {pushEnabled ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={timeId}>{t("merenje.settings.time")}</Label>
          <select
            id={timeId}
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              setSaved(false);
            }}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {saved && !error ? (
        <p className="text-sm text-primary" role="status">
          {t("merenje.settings.saved")}
        </p>
      ) : null}

      <Button onClick={handleSave} disabled={pending || unchanged}>
        {pending ? t("profil.saving") : t("merenje.settings.save")}
      </Button>
    </Card>
  );
}
