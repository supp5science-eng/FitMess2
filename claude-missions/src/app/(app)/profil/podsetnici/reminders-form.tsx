"use client";

import { Bell, BellOff, Check, Send, Smartphone } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  disablePush,
  enablePush,
  notificationPermission,
  pushEnvironment,
} from "@/lib/push/client";
import { cn } from "@/lib/utils";

import { saveNoLogReminderAction } from "./actions";

// The Podsetnici screen's interactive half.
//
// Order of operations matters here and is easy to get wrong: the browser
// permission and the saved preference are TWO different things, and a user can
// have one without the other (allowed notifications but reminder off; reminder
// on but later revoked permission in iOS settings). So the switch drives BOTH —
// turning it on subscribes the device AND saves the row; turning it off does
// the reverse — and the screen re-reads the browser's own state on mount so it
// can never claim reminders are on when the OS has muted them.
//
// Everything the environment cannot do is said plainly instead of failing
// silently: an iPhone in a Safari tab is told to install the app, a blocked
// permission is told where to unblock it.

/** Quarter-hour options through the day. Kept to sensible waking hours: this
 * reminder is about "you haven't eaten-and-logged yet today". */
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let hour = 7; hour <= 21; hour += 1) {
    for (const minute of ["00", "30"]) out.push(`${String(hour).padStart(2, "0")}:${minute}`);
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

export function RemindersForm({
  initialEnabled,
  initialTime,
  vapidPublicKey,
}: {
  initialEnabled: boolean;
  initialTime: string;
  vapidPublicKey: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [time, setTime] = useState(
    TIME_OPTIONS.includes(initialTime) ? initialTime : "12:00"
  );
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

  async function toggle(next: boolean) {
    setStatus({ kind: "working" });
    setTestStatus({ kind: "idle" });

    if (next) {
      const subscribed = await enablePush(vapidPublicKey);
      setGrantedNow(notificationPermission());
      if (!subscribed.ok) {
        setStatus({ kind: "error", message: subscribed.message });
        return;
      }
    } else {
      await disablePush();
    }

    const saved = await saveNoLogReminderAction(next, time);
    if (!saved.ok) {
      setStatus({
        kind: "error",
        message: saved.error_sr ?? "Nešto je pošlo naopako.",
      });
      return;
    }

    setEnabled(next);
    setStatus({ kind: "saved" });
  }

  async function changeTime(next: string) {
    setTime(next);
    if (!enabled) return;

    setStatus({ kind: "working" });
    const saved = await saveNoLogReminderAction(true, next);
    setStatus(
      saved.ok
        ? { kind: "saved" }
        : {
            kind: "error",
            message: saved.error_sr ?? "Nešto je pošlo naopako.",
          }
    );
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
      {/* The one switch. */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              enabled
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {enabled ? (
              <Bell className="size-5" aria-hidden="true" />
            ) : (
              <BellOff className="size-5" aria-hidden="true" />
            )}
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold text-foreground">
              Podsetnik za unos
            </span>
            <span className="text-sm text-muted-foreground">
              {"„Danas još nisi ništa uneo” — stiže samo ako je dan prazan."}
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Podsetnik za unos"
            data-testid="reminder-toggle"
            disabled={status.kind === "working" || (!enabled && !canArm)}
            onClick={() => toggle(!enabled)}
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

        {/* Time picker: a native <select>, which is the iOS wheel — the same
            choice the onboarding wizard settled on. */}
        <label className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm font-medium text-foreground">
            Vreme podsetnika
          </span>
          <select
            value={time}
            data-testid="reminder-time"
            disabled={status.kind === "working"}
            onChange={(event) => changeTime(event.target.value)}
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-base font-semibold text-foreground"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* What the environment can and cannot do — said out loud. */}
      {environment === "needs-install" ? (
        <p
          data-testid="reminder-needs-install"
          className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Na iPhone-u notifikacije rade samo kad je FitMess dodat na početni
            ekran. Otvori Podeli → {"„Dodaj na početni ekran”"}, pa uključi
            podsetnik iz instalirane aplikacije.
          </span>
        </p>
      ) : null}

      {environment === "unsupported" ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Ovaj pregledač ne podržava notifikacije.
        </p>
      ) : null}

      {blocked ? (
        <p
          data-testid="reminder-blocked"
          className="rounded-2xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground"
        >
          Notifikacije su blokirane za FitMess. Uključi ih u podešavanjima
          telefona (Notifikacije → FitMess) pa se vrati ovde.
        </p>
      ) : null}

      {missingKey ? (
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
      {enabled ? (
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
