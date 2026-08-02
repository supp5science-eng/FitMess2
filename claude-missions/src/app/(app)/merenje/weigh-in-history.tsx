"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/locale";
import type { TFunction } from "@/lib/i18n/translate";
import type { WeighInRow } from "@/lib/weight/weigh-ins";

/**
 * Nedeljno merenje: the recent readings, and the way to take one back out.
 *
 * The list is here because of the delete, not the other way round. Re-weighing
 * already fixes a wrong number on the day it was typed (the API upserts on
 * `(user_id, day)`), so the case this screen was missing is the one that
 * survives past midnight: a value entered while testing, or a reading taken in
 * the evening after dinner. That point then sits in the trend for weeks,
 * arguing for a plan correction out of noise -- and, worse, silences the whole
 * feature, because a reading inside the grace window counts as the week
 * ANSWERED (`EARLY_GRACE_DAYS`), so the banner and the weekly push both go
 * quiet on a week nobody actually weighed.
 *
 * Deleting is one tap, with five seconds to change your mind. No confirmation
 * dialog: a modal asking "are you sure?" makes the user carry the decision,
 * and undo carries it for them. The row disappears immediately -- what waits
 * out the five seconds is the REQUEST, not the feedback, so "Poništi" is a
 * cancelled timer rather than a second write that would have to re-create a
 * past day the POST route deliberately refuses to accept.
 */

/** How long the undo stays on offer -- and therefore how long the delete waits. */
const UNDO_MS = 5000;

/** Fire-and-forget delete. `keepalive` so a pending one still lands if this
 * runs from a page that is being closed. */
function sendDelete(day: string): Promise<Response> {
  return fetch("/api/merenje", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day }),
    keepalive: true,
  });
}

function formatDay(
  dayKey: string,
  locale: Locale,
  todayKey: string,
  yesterdayKey: string,
  t: TFunction
): string {
  if (dayKey === todayKey) return t("merenje.history.today");
  if (dayKey === yesterdayKey) return t("merenje.history.yesterday");

  const [year, month, day] = dayKey.split("-").map(Number);
  // Noon UTC and `timeZone: "UTC"` together: the key already IS the Belgrade
  // calendar day, so any further timezone work could only shift it off by one.
  return new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn-RS" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, month! - 1, day!, 12)));
}

function formatWeight(kg: number, locale: Locale): string {
  const text = kg.toFixed(1);
  return locale === "sr" ? text.replace(".", ",") : text;
}

export function WeighInHistory({
  rows,
  todayKey,
  yesterdayKey,
}: {
  /** Newest first. */
  rows: WeighInRow[];
  todayKey: string;
  yesterdayKey: string;
}) {
  const router = useRouter();
  const { t, locale } = useT();

  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mirrors of the above for the unmount flush: an effect cleanup that closed
  // over state would see whatever it was when the effect ran.
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    async (day: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = null;

      try {
        const response = await sendDelete(day);
        if (!response.ok) throw new Error(String(response.status));
        setPendingDay((current) => (current === day ? null : current));
        // The banner on `/danas` and the verdict card below both derive from
        // this row's absence, so the server has to be asked again.
        router.refresh();
      } catch {
        // Put the row back rather than leave a screen that disagrees with the
        // database about what exists.
        setPendingDay((current) => (current === day ? null : current));
        setError(t("merenje.history.deleteError"));
      }
    },
    [router, t]
  );

  function handleDelete(day: string) {
    setError(null);

    // A second delete while one is still waiting: the first one has had its
    // undo offered and not taken, so it goes now rather than being lost.
    const waiting = pendingRef.current;
    if (waiting && waiting !== day) void commit(waiting);

    pendingRef.current = day;
    setPendingDay(day);
    timerRef.current = setTimeout(() => void commit(day), UNDO_MS);
  }

  function handleUndo() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    setPendingDay(null);
  }

  // Leaving the screen (or closing the app) with a delete still counting down
  // commits it: the row is already gone from the user's view, and a deletion
  // that silently un-happens because they navigated away is the worse surprise.
  useEffect(() => {
    function flush() {
      const day = pendingRef.current;
      if (!day) return;
      pendingRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      // Nothing can be reported from a screen that is going away, and an
      // uncaught rejection here would surface as a console error on every
      // backgrounded app. The row is restored on the next render either way,
      // because the server render is the source of truth for what exists.
      void sendDelete(day).catch(() => {});
    }

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const visible = rows.filter((row) => row.day !== pendingDay);

  return (
    <Card className="flex flex-col gap-3 p-5" data-testid="weigh-in-history">
      <h2 className="text-sm font-semibold text-foreground">
        {t("merenje.history.title")}
      </h2>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("merenje.history.empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((row) => {
            const label = formatDay(
              row.day,
              locale,
              todayKey,
              yesterdayKey,
              t
            );
            return (
              <li
                key={row.day}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                data-testid="weigh-in-history-row"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {label}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {formatWeight(row.weightKg, locale)} kg
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(row.day)}
                  aria-label={t("merenje.history.delete", { date: label })}
                  data-testid={`weigh-in-delete-${row.day}`}
                  className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden={true} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDay ? (
        <div
          role="status"
          data-testid="weigh-in-undo"
          className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 text-sm text-muted-foreground">
            {t("merenje.history.deleted")}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="shrink-0 text-sm font-semibold text-primary"
          >
            {t("merenje.history.undo")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
