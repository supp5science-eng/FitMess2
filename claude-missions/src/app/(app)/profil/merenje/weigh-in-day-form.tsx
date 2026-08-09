"use client";

import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  enablePush,
  notificationPermission,
  pushEnvironment,
} from "@/lib/push/client";
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

/** Neither browser fact below changes without the user acting inside this
 * component, so there is nothing to subscribe to. Same shape as the Podsetnici
 * screen, which reads the identical pair. */
const noopSubscribe = () => () => {};

/**
 * "Dan merenja" -- pick the weekday, the time, and whether the phone should
 * bother you about it.
 *
 * Native `<select>`s on purpose: on iOS they open the system wheel, which is
 * the same control the onboarding number fields use, and it needs no custom
 * dropdown that would then have to be made accessible and themeable.
 *
 * The checkbox arms the DEVICE (2026-08-01). Until then this screen wrote
 * `weighin_enabled = true` and nothing else: no permission prompt, no push
 * subscription. The row said "remind me", the sender found no device, and
 * skipped it in silence -- a switch that looked on and did nothing. Worse, the
 * 0024 migration defaulted the column to true for everyone, so the ONLY users
 * the weigh-in reminder could ever reach were those who had separately turned
 * on a daily reminder in Podsetnici. Hence also `deviceArmed`: when the setting
 * is on but this phone is not subscribed, the screen says so and offers the one
 * button that fixes it, instead of quietly promising a push that cannot arrive.
 */
export function WeighInDayForm({
  initialDay,
  initialTime,
  initialPushEnabled,
  vapidPublicKey,
}: {
  initialDay: number;
  initialTime: string;
  initialPushEnabled: boolean;
  vapidPublicKey: string;
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
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // `null` on the server render = "not known yet", so nothing is claimed about
  // the device until the browser has actually been asked.
  const environment = useSyncExternalStore(
    noopSubscribe,
    () => pushEnvironment().state,
    () => null
  );
  const browserPermission = useSyncExternalStore(
    noopSubscribe,
    () => notificationPermission(),
    () => null
  );
  const [grantedNow, setGrantedNow] = useState<NotificationPermission | null>(
    null
  );
  const permission = grantedNow ?? browserPermission;

  const missingKey = vapidPublicKey.trim() === "";
  /** True once this phone can actually receive the push. */
  const deviceArmed = permission === "granted";

  const unchanged =
    day === initialDay &&
    time === initialTime &&
    pushEnabled === initialPushEnabled;

  /**
   * Permission + subscription for THIS device.
   *
   * Must run inside the click that asked for it: iOS refuses
   * `Notification.requestPermission()` outside a user gesture, which is why
   * this is not folded into the save action.
   */
  async function armDevice(): Promise<boolean> {
    setArming(true);
    setError(null);
    const result = await enablePush(vapidPublicKey);
    setGrantedNow(notificationPermission());
    setArming(false);

    if (!result.ok) {
      setError(result.message);
      return false;
    }
    return true;
  }

  async function handlePushToggle(next: boolean) {
    setSaved(false);
    setError(null);

    // Turning it OFF leaves the device subscribed on purpose: the daily
    // reminders share that one subscription, so tearing it down here would
    // switch off somebody else's morning nudge too.
    if (!next) {
      setPushEnabled(false);
      return;
    }

    if (await armDevice()) setPushEnabled(true);
  }

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
          disabled={arming}
          onChange={(event) => {
            void handlePushToggle(event.target.checked);
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

      {/* The device truth, said out loud. One message at a time and only when
          the reminder is supposed to be on: an iPhone in a Safari tab cannot
          act on "unblock notifications" advice, and a granted phone needs no
          message at all. */}
      {pushEnabled && environment === "native" ? (
        // Inside the store app, none of the browser explanations below apply:
        // delivery goes through the OS, which this build does not speak yet.
        <p
          data-testid="weigh-in-push-native"
          className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"
        >
          {t("profil.reminders.native")}
        </p>
      ) : pushEnabled && environment === "needs-install" ? (
        <p
          data-testid="weigh-in-push-needs-install"
          className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"
        >
          {t("profil.reminders.needsInstall")}
        </p>
      ) : pushEnabled && environment === "unsupported" ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("profil.reminders.unsupported")}
        </p>
      ) : pushEnabled && permission === "denied" ? (
        <p
          data-testid="weigh-in-push-blocked"
          className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground"
        >
          {t("profil.reminders.blocked")}
        </p>
      ) : pushEnabled && missingKey ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          {t("profil.reminders.missingKey")}
        </p>
      ) : pushEnabled && environment === "ready" && !deviceArmed ? (
        // The 0024 default (`weighin_enabled = true`) means most people land
        // here with the setting on and the phone never asked. One button.
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">
            {t("merenje.settings.pushNotOnThisPhone")}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={arming}
            onClick={() => void armDevice()}
            data-testid="weigh-in-push-arm"
          >
            {arming
              ? t("profil.saving")
              : t("merenje.settings.pushArmThisPhone")}
          </Button>
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
