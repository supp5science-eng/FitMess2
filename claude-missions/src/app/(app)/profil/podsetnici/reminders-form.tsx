"use client";

import Link from "next/link";
import {
  Check,
  ChevronRight,
  Moon,
  Scale,
  Send,
  Smartphone,
  Sun,
  Trophy,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  disablePush,
  enablePush,
  notificationPermission,
  pushEnvironment,
} from "@/lib/push/client";
import { cn } from "@/lib/utils";
import { WEIGH_IN_DAY_LABELS_SR } from "@/lib/weight/weigh-in-day";

import {
  saveRemindersAction,
  saveWeighInEnabledAction,
  type ReminderPreferences,
} from "./actions";

// The Podsetnici screen's interactive half.
//
// Order of operations matters here and is easy to get wrong: the browser
// permission and the saved preference are TWO different things, and a user can
// have one without the other (allowed notifications but reminders off; reminders
// on but later revoked permission in iOS settings). So the switches drive BOTH —
// turning the first one on subscribes the device AND saves the row; turning the
// last one off does the reverse — and the screen re-reads the browser's own
// state on mount so it can never claim reminders are on when the OS has muted
// them.
//
// The switches share ONE device subscription: it is not per-reminder, it
// belongs to the device — so it is armed the moment anything is switched on and
// released only when everything is off. That "everything" must include the
// weekly weigh-in (2026-08-01), or turning the daily ones off silently takes
// the weekly one down with them.
//
// Everything the environment cannot do is said plainly instead of failing
// silently: an iPhone in a Safari tab is told to install the app, a blocked
// permission is told where to unblock it.

/** Half-hour options through the day. Kept to waking hours: these reminders are
 * about the day you are living, not the one you are sleeping through. */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let hour = 6; hour <= 23; hour += 1) {
    for (const minute of ["00", "30"]) {
      out.push(`${String(hour).padStart(2, "0")}:${minute}`);
    }
  }
  return out;
})();

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/** Neither of the two browser facts below can change without the user acting
 * inside this component, so there is nothing to subscribe to. */
const noopSubscribe = () => () => {};

function fallbackTime(value: string, fallback: string): string {
  return TIME_OPTIONS.includes(value) ? value : fallback;
}

/** The weekly weigh-in reminder as this screen knows it: a switch it owns, and
 * a schedule it only reports (that lives on `/profil/merenje`). */
export interface WeighInReminder {
  enabled: boolean;
  /** 0 = Monday .. 6 = Sunday. */
  day: number;
  /** `"HH:MM"`. */
  time: string;
}

export function RemindersForm({
  initial,
  weighIn,
  vapidPublicKey,
}: {
  initial: ReminderPreferences;
  weighIn: WeighInReminder;
  vapidPublicKey: string;
}) {
  const { t } = useT();
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    ...initial,
    eveningTime: fallbackTime(initial.eveningTime, "20:00"),
  });
  const [weighInEnabled, setWeighInEnabled] = useState(weighIn.enabled);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [testStatus, setTestStatus] = useState<Status>({ kind: "idle" });

  // Two facts only the browser knows: whether this window can subscribe at all
  // (installed app vs Safari tab) and the current notification permission. Read
  // through `useSyncExternalStore` rather than an effect + setState, so the
  // server render has an explicit snapshot (`null` = "not known yet") and there
  // is no state write during render/commit.
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
  // After we prompt, `Notification.permission` has changed but nothing tells
  // the store to re-read; the handler records the new value here.
  const [grantedNow, setGrantedNow] = useState<NotificationPermission | null>(
    null
  );
  const permission = grantedNow ?? browserPermission;

  const missingKey = vapidPublicKey.trim() === "";
  const blocked = permission === "denied";
  const canArm = environment === "ready" && !missingKey && !blocked;

  // The weigh-in counts (2026-08-01). It shares the one device subscription
  // with the rest, so leaving it out meant switching the three daily reminders
  // off tore down the subscription the weekly weigh-in was still relying on —
  // and the user who wanted ONLY the weigh-in got nothing at all.
  const anyOn =
    preferences.mealEnabled ||
    preferences.eveningEnabled ||
    preferences.awardEnabled ||
    weighInEnabled;
  const busy = status.kind === "working";

  // Exactly one explanation, most-blocking first: an iPhone in a Safari tab
  // cannot act on "unblock notifications" advice, and a device with no Push API
  // cannot act on either.
  const notice:
    | "native"
    | "unsupported"
    | "needs-install"
    | "blocked"
    | "missing-key"
    | null =
    // The native shell outranks everything: inside it, none of the other
    // explanations are even true. It has no Push API to be "unsupported"
    // about, it IS the installed app, and the browser permission it would
    // report is not the one that governs delivery.
    environment === "native"
      ? "native"
      : environment === "unsupported"
        ? "unsupported"
        : environment === "needs-install"
          ? "needs-install"
          : blocked
            ? "blocked"
            : missingKey
              ? "missing-key"
              : null;

  /**
   * Applies a change to the preferences, arming or releasing the device
   * subscription as the "is anything on?" answer flips.
   *
   * Subscribing FIRST and saving second matters: if the permission prompt is
   * dismissed there must be no saved row claiming a reminder the device can
   * never deliver.
   */
  async function apply(next: ReminderPreferences) {
    const willBeOn =
      next.mealEnabled ||
      next.eveningEnabled ||
      next.awardEnabled ||
      weighInEnabled;

    if (!(await syncSubscription(willBeOn))) return;

    const saved = await saveRemindersAction(next);
    if (!saved.ok) {
      setStatus({
        kind: "error",
        message: saved.error_sr ?? t("profil.reminders.errorGeneric"),
      });
      return;
    }

    setPreferences(next);
    setStatus({ kind: "saved" });
  }

  /** The weekly weigh-in switch. Its day and time are not editable here — the
   * row links to `/profil/merenje`, which owns them. */
  async function applyWeighIn(next: boolean) {
    const willBeOn =
      preferences.mealEnabled ||
      preferences.eveningEnabled ||
      preferences.awardEnabled ||
      next;

    if (!(await syncSubscription(willBeOn))) return;

    const saved = await saveWeighInEnabledAction(next);
    if (!saved.ok) {
      setStatus({
        kind: "error",
        message: saved.error_sr ?? t("profil.reminders.errorGeneric"),
      });
      return;
    }

    setWeighInEnabled(next);
    setStatus({ kind: "saved" });
  }

  /**
   * Arms or releases this device's subscription to match "is anything on?",
   * and reports whether it is safe to write the setting.
   *
   * Subscribing FIRST and saving second matters: if the permission prompt is
   * dismissed there must be no saved row claiming a reminder the device can
   * never deliver.
   */
  async function syncSubscription(willBeOn: boolean): Promise<boolean> {
    const wasOn = anyOn;

    setStatus({ kind: "working" });
    setTestStatus({ kind: "idle" });

    if (willBeOn && !wasOn) {
      const subscribed = await enablePush(vapidPublicKey);
      setGrantedNow(notificationPermission());
      if (!subscribed.ok) {
        setStatus({ kind: "error", message: subscribed.message });
        return false;
      }
    } else if (!willBeOn && wasOn) {
      await disablePush();
    }

    return true;
  }

  async function sendTest() {
    setTestStatus({ kind: "working" });
    try {
      const response = await fetch("/api/podsetnici/proba", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error_sr?: string;
      } | null;

      setTestStatus(
        response.ok && body?.ok
          ? { kind: "saved" }
          : {
              kind: "error",
              message: body?.error_sr ?? t("profil.reminders.testError"),
            }
      );
    } catch {
      setTestStatus({
        kind: "error",
        message: t("profil.reminders.testError"),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        {/* No time picker, and that is the whole point (2026-08-01): this
            reminder is timed by the user's own median logging time for the
            meal that is missing. Its predecessor was a fixed 10:00 "upiši
            doručak" that fired whether or not you had already logged — a
            clock, not a reminder. */}
        <ReminderRow
          icon={<Sun className="size-5" aria-hidden="true" />}
          title={t("profil.reminders.mealTitle")}
          description={t("profil.reminders.mealDesc")}
          testId="reminder-meal"
          enabled={preferences.mealEnabled}
          disabled={busy || (!preferences.mealEnabled && !canArm)}
          onToggle={(value) => apply({ ...preferences, mealEnabled: value })}
        />

        <ReminderRow
          className="border-t border-border pt-3"
          icon={<Moon className="size-5" aria-hidden="true" />}
          title={t("profil.reminders.eveningTitle")}
          description={t("profil.reminders.eveningDesc")}
          testId="reminder-evening"
          enabled={preferences.eveningEnabled}
          disabled={busy || (!preferences.eveningEnabled && !canArm)}
          onToggle={(value) => apply({ ...preferences, eveningEnabled: value })}
          time={preferences.eveningTime}
          onTimeChange={(value) =>
            apply({ ...preferences, eveningTime: value, eveningEnabled: true })
          }
          timeDisabled={busy}
        />

        {/* The weekly one. No time picker here on purpose: the day and the time
            belong to `/profil/merenje`, because the same weekday also drives
            the `/danas` banner and the weekly trend — it is not merely a
            notification schedule. This row shows it and links there. */}
        <ReminderRow
          className="border-t border-border pt-3"
          icon={<Scale className="size-5" aria-hidden="true" />}
          title={t("profil.reminders.weighInTitle")}
          description={`${WEIGH_IN_DAY_LABELS_SR[weighIn.day] ?? WEIGH_IN_DAY_LABELS_SR[6]} u ${weighIn.time}`}
          testId="reminder-weighin"
          enabled={weighInEnabled}
          disabled={busy || (!weighInEnabled && !canArm)}
          onToggle={(value) => applyWeighIn(value)}
        >
          {weighInEnabled ? (
            <Link
              href="/profil/merenje"
              data-testid="reminder-weighin-link"
              className="flex min-h-11 items-center justify-between gap-2 pl-13 text-sm font-medium text-muted-foreground"
            >
              {t("profil.reminders.weighInChange")}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </ReminderRow>

        {/* No time picker: this one is earned, not scheduled. */}
        <ReminderRow
          className="border-t border-border pt-3"
          icon={<Trophy className="size-5" aria-hidden="true" />}
          title={t("profil.reminders.awardTitle")}
          description={t("profil.reminders.awardDesc")}
          testId="reminder-award"
          enabled={preferences.awardEnabled}
          disabled={busy || (!preferences.awardEnabled && !canArm)}
          onToggle={(value) => apply({ ...preferences, awardEnabled: value })}
        />
      </div>

      {/* What the environment can and cannot do — said out loud, but ONE
          message at a time. Screenshotting this page caught it stacking the
          "install the app first" and "notifications are blocked" notices on
          top of each other: two different instructions for one problem.
          Priority: no Push API at all > must be installed > blocked > server
          not configured. */}
      {notice === "native" ? (
        <p
          data-testid="reminder-native"
          className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("profil.reminders.native")}</span>
        </p>
      ) : null}

      {notice === "unsupported" ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          {t("profil.reminders.unsupported")}
        </p>
      ) : null}

      {notice === "needs-install" ? (
        <p
          data-testid="reminder-needs-install"
          className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{t("profil.reminders.needsInstall")}</span>
        </p>
      ) : null}

      {notice === "blocked" ? (
        <p
          data-testid="reminder-blocked"
          className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          {t("profil.reminders.blocked")}
        </p>
      ) : null}

      {notice === "missing-key" ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          {t("profil.reminders.missingKey")}
        </p>
      ) : null}

      {status.kind === "error" ? (
        <p
          role="alert"
          data-testid="reminder-error"
          className="text-sm font-medium text-destructive"
        >
          {status.message}
        </p>
      ) : null}

      {status.kind === "saved" ? (
        <p
          data-testid="reminder-saved"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Check className="size-4 text-primary" aria-hidden="true" />
          {t("profil.saved")}
        </p>
      ) : null}

      {/* "Does it actually work?" — without this the user has to wait until the
          scheduled time to learn anything. */}
      {anyOn ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={sendTest}
            disabled={testStatus.kind === "working"}
            data-testid="reminder-test-button"
            className="h-12 w-full text-base"
          >
            <Send className="size-4" aria-hidden="true" />
            {testStatus.kind === "working"
              ? t("profil.reminders.sending")
              : t("profil.reminders.sendTest")}
          </Button>

          {testStatus.kind === "saved" ? (
            <p
              data-testid="reminder-test-sent"
              className="text-center text-sm text-muted-foreground"
            >
              {t("profil.reminders.testSent")}
            </p>
          ) : null}
          {testStatus.kind === "error" ? (
            <p
              role="alert"
              data-testid="reminder-test-error"
              className="text-center text-sm font-medium text-destructive"
            >
              {testStatus.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One reminder: icon, name, switch, and — for the scheduled ones — a time.
 * The time picker is a native `<select>`, which is the iOS wheel: the same
 * choice the onboarding wizard settled on. `children` is for a row whose
 * schedule is set elsewhere and which therefore needs a link instead. */
function ReminderRow({
  icon,
  title,
  description,
  testId,
  enabled,
  disabled,
  onToggle,
  time,
  onTimeChange,
  timeDisabled,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: (value: boolean) => void;
  time?: string;
  onTimeChange?: (value: string) => void;
  timeDisabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            enabled
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold text-foreground">
            {title}
          </span>
          <span className="text-sm text-muted-foreground">{description}</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          data-testid={`${testId}-toggle`}
          disabled={disabled}
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40",
            enabled ? "bg-primary" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]",
              enabled ? "left-[1.375rem]" : "left-0.5"
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* The time only exists while the reminder does — a picker for something
          switched off is a control that does nothing. */}
      {time && onTimeChange && enabled ? (
        <label className="flex items-center justify-between gap-3 pl-13">
          <span className="text-sm font-medium text-muted-foreground">
            {t("profil.reminders.time")}
          </span>
          <select
            value={time}
            data-testid={`${testId}-time`}
            disabled={timeDisabled}
            onChange={(event) => onTimeChange(event.target.value)}
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-base font-semibold text-foreground"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {children}
    </div>
  );
}
