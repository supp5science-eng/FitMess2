"use client";

import { useEffect, useState } from "react";
import { CalendarSync } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * "Sutrašnji plan je preračunat" -- shown once, on the visit right after the
 * entry that took today over its target.
 *
 * Why this exists at all: `computeAdaptivePlan` only ever reads days BEFORE
 * today (`spentBeforeToday`), so going over at lunch does not move the number
 * on screen -- it moves tomorrow's. Correct arithmetic, useless feedback. The
 * cause and its consequence landed twelve hours apart, with nothing connecting
 * them, and the plan looked arbitrary the next morning as a result.
 *
 * Every add flow ends in `router.push("/danas")`, so a server-decided notice on
 * this screen IS "immediately after logging" in practice -- no client-side
 * threshold watching, and no way for an edit or a delete to re-fire it.
 *
 * Deliberately not a nag: it states the recalculated number and steps aside.
 * No red, no exclamation, no "you went over" -- going over is a fact the plan
 * absorbs, not a verdict on the person. Once per day (`fm_over` cookie).
 */

/** Day key in the cookie, so a new day re-arms without touching the expiry. */
const OVER_COOKIE_MAX_AGE = 60 * 60 * 48;

export const OVER_NOTICE_COOKIE = "fm_over";

/** Long enough to read two lines without hurrying, short enough that it is
 * gone before it becomes part of the furniture. */
const AUTO_DISMISS_MS = 7000;
const FADE_OUT_MS = 320;

function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

export function OverNotice({
  overKcal,
  tomorrowKcal,
  dayKey,
}: {
  /** How far today's intake went past today's target. */
  overKcal: number;
  /** Tomorrow's recalculated target, or `null` when today ends the week --
   * there is then no remaining day to absorb anything and the overage leaves
   * the week entirely (it returns as next week's carry-in). */
  tomorrowKcal: number | null;
  dayKey: string;
}) {
  const { t } = useT();
  const [visible, setVisible] = useState(true);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Burned on mount, not on dismiss: navigating away mid-message still spends
    // the moment. Re-showing it on the next tap would be worse than missing it.
    try {
      writeCookie(OVER_NOTICE_COOKIE, dayKey, OVER_COOKIE_MAX_AGE);
    } catch {
      // A blocked cookie only means the notice may repeat -- never a crash.
    }
  }, [dayKey]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setVisible(false), AUTO_DISMISS_MS),
      window.setTimeout(() => setGone(true), AUTO_DISMISS_MS + FADE_OUT_MS),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, []);

  if (gone) return null;

  const isLastDayOfWeek = tomorrowKcal === null;

  return (
    <button
      type="button"
      data-testid="over-notice"
      onClick={() => {
        setVisible(false);
        window.setTimeout(() => setGone(true), FADE_OUT_MS);
      }}
      className={cn(
        "home-body flex w-full items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-left text-sm transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <CalendarSync className="size-5 shrink-0 text-primary" aria-hidden={true} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-foreground">
          {isLastDayOfWeek
            ? t("home.overNotice.spill", { kcal: formatNumber(overKcal) })
            : t("home.overNotice.title")}
        </span>
        {/* The recalculated number leads; what caused it follows, smaller.
            Opening with "you went 320 over" is the accusation this screen
            exists to avoid. */}
        {!isLastDayOfWeek ? (
          <span className="text-xs text-muted-foreground">
            <span
              data-testid="over-notice-tomorrow"
              className="font-medium tabular-nums text-foreground"
            >
              {formatNumber(tomorrowKcal)} kcal
            </span>{" "}
            · {t("home.overNotice.over", { kcal: formatNumber(overKcal) })}
          </span>
        ) : null}
      </span>
    </button>
  );
}
