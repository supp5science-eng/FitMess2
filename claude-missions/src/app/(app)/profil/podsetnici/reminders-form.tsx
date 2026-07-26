"use client";

import { Check, Moon, Send, Smartphone, Sun, Trophy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  disablePush,
  enablePush,
  notificationPermission,
  pushEnvironment,
} from "@/lib/push/client";
import { cn } from "@/lib/utils";

import { saveRemindersAction, type ReminderPreferences } from "./actions";

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
// v2 (2026-07-26) has three switches sharing ONE device subscription: the
// morning nudge, the evening recap, and the earned "pun dan" trophy. The
// subscription is not per-reminder — it belongs to the device — so it is armed
// the moment anything is switched on and released only when everything is off.
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

export function RemindersForm({
  initial,
  vapidPublicKey,
}: {
  initial: ReminderPreferences;
  vapidPublicKey: string;
}) {
  const [preferences, setPreferences] = useState<ReminderPreferences>({
    ...initial,
    morningTime: fallbackTime(initial.morningTime, "10:00"),
    eveningTime: fallbackTime(initial.eveningTime, "20:00"),
  });
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

  const anyOn =
    preferences.morningEnabled ||
    preferences.eveningEnabled ||
    preferences.awardEnabled;
  const busy = status.kind === "working";

  // Exactly one explanation, most-blocking first: an iPhone in a Safari tab
  // cannot act on "unblock notifications" advice, and a device with no Push API
  // cannot act on either.
  const notice:
    | "unsupported"
    | "needs-install"
    | "blocked"
    | "missing-key"
    | null =
    environment === "unsupported"
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
    const wasOn = anyOn;
    const willBeOn =
      next.morningEnabled || next.eveningEnabled || next.awardEnabled;

    setStatus({ kind: "working" });
    setTestStatus({ kind: "idle" });

    if (willBeOn && !wasOn) {
      const subscribed = await enablePush(vapidPublicKey);
      setGrantedNow(notificationPermission());
      if (!subscribed.ok) {
        setStatus({ kind: "error", message: subscribed.message });
        return;
      }
    } else if (!willBeOn && wasOn) {
      await disablePush();
    }

    const saved = await saveRemindersAction(next);
    if (!saved.ok) {
      setStatus({
        kind: "error",
        message: saved.error_sr ?? "Nešto je pošlo naopako.",
      });
      return;
    }

    setPreferences(next);
    setStatus({ kind: "saved" });
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
              message:
                body?.error_sr ??
                "Nismo uspeli da pošaljemo probnu notifikaciju.",
            }
      );
    } catch {
      setTestStatus({
        kind: "error",
        message: "Nismo uspeli da pošaljemo probnu notifikaciju.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <ReminderRow
          icon={<Sun className="size-5" aria-hidden="true" />}
          title="Jutarnji podsetnik"
          description="Podseti me da upišem doručak."
          testId="reminder-morning"
          enabled={preferences.morningEnabled}
          disabled={busy || (!preferences.morningEnabled && !canArm)}
          onToggle={(value) => apply({ ...preferences, morningEnabled: value })}
          time={preferences.morningTime}
          onTimeChange={(value) =>
            apply({ ...preferences, morningTime: value, morningEnabled: true })
          }
          timeDisabled={busy}
        />

        <ReminderRow
          className="border-t border-border pt-3"
          icon={<Moon className="size-5" aria-hidden="true" />}
          title="Večernji pregled"
          description="Koliko ti je kalorija ostalo i šta si upisao."
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

        {/* No time picker: this one is earned, not scheduled. */}
        <ReminderRow
          className="border-t border-border pt-3"
          icon={<Trophy className="size-5" aria-hidden="true" />}
          title="Nagrada za pun dan"
          description="Javi mi kad upišem treći obrok."
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
      {notice === "unsupported" ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Ovaj pregledač ne podržava notifikacije.
        </p>
      ) : null}

      {notice === "needs-install" ? (
        <p
          data-testid="reminder-needs-install"
          className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Na iPhone-u notifikacije rade samo kad je FitMess dodat na početni
            ekran. Otvori Podeli → {"„Dodaj na početni ekran”"}, pa uključi
            podsetnike iz instalirane aplikacije.
          </span>
        </p>
      ) : null}

      {notice === "blocked" ? (
        <p
          data-testid="reminder-blocked"
          className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          Notifikacije su blokirane za FitMess. Uključi ih u podešavanjima
          telefona (Notifikacije → FitMess) pa se vrati ovde.
        </p>
      ) : null}

      {notice === "missing-key" ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Notifikacije još nisu podešene na serveru.
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
          Sačuvano.
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
              ? "Šaljem..."
              : "Pošalji probnu notifikaciju"}
          </Button>

          {testStatus.kind === "saved" ? (
            <p
              data-testid="reminder-test-sent"
              className="text-center text-sm text-muted-foreground"
            >
              Poslato — trebalo bi da stigne za koji sekund.
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
 * choice the onboarding wizard settled on. */
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
}) {
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
            Vreme
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
    </div>
  );
}
