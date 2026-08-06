"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import {
  DAY_ANSWER_COOKIE,
  withDayAnswer,
  type DayAnswer,
  type DayVerdict,
} from "@/lib/home/day-trust";

/**
 * "Je li sreda stvarno bio dan od 420 kcal?" -- the one place a user can
 * correct the plan's guess about a past day.
 *
 * Why it has to exist: `day-trust.ts` refuses to believe a day whose logged
 * total falls below BMR, and counts it AS A DAY ON PLAN instead. That is the
 * right default (a forgotten lunch must not read as a 400 kcal day), but it IS
 * a guess -- and for someone who genuinely had a light day it is the wrong one,
 * silently. This asks, once, and the answer beats the heuristic.
 *
 * It had no home between 2026-08-01 and 2026-08-06: the answer lived on the
 * plan card, the card was deleted, and `day-trust.ts` plus the `fm_dani` cookie
 * kept working with nothing left to feed them. Deliberately brought back as a
 * small standalone row rather than as a card -- a question is a request, so it
 * belongs with the weigh-in banner above the ring, and it disappears the moment
 * it is answered.
 *
 * ONE day at a time, oldest first: two questions stacked read as a form, and a
 * form on the home screen is something people close rather than answer.
 */

/** Comfortably longer than the 21-day window the plan looks back over. */
const DAY_ANSWER_MAX_AGE = 60 * 60 * 24 * 60;

function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

/** `"2026-01-06"` -> 0 = Monday .. 6 = Sunday. */
function weekdayIndexOf(dayKey: string): number {
  const utcDay = new Date(`${dayKey}T12:00:00.000Z`).getUTCDay();
  return (utcDay + 6) % 7;
}

export function DayQuestion({
  days,
  dayKey,
}: {
  /** Untrusted days from the plan; only `needsAnswer` ones are asked about. */
  days: DayVerdict[];
  /** Today's Belgrade day key -- the "asked on" stamp in the cookie. */
  dayKey: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const [answered, setAnswered] = useState<string[]>([]);

  const asked = days.filter(
    (day) => day.needsAnswer && !answered.includes(day.dayKey)
  );
  const day = asked[0];
  if (!day) return null;

  function answer(untrustedDayKey: string, value: DayAnswer) {
    // Hide the row immediately: the server refresh below is the authority, but
    // the tap has to feel instant.
    setAnswered((previous) => [...previous, untrustedDayKey]);

    // ⚠️ Order matters. The cookie write and the refresh happen FIRST and
    // unconditionally, because they are what makes the answer take effect on
    // this device. The network call is an addition, not a prerequisite -- it
    // must never be able to swallow an answer the user already gave, whether it
    // fails, hangs, or (offline) never resolves at all.
    try {
      writeCookie(
        DAY_ANSWER_COOKIE,
        withDayAnswer(
          readCookie(DAY_ANSWER_COOKIE),
          untrustedDayKey,
          value,
          dayKey
        ),
        DAY_ANSWER_MAX_AGE
      );
    } catch {
      // A blocked cookie costs the answer, never the screen.
    }
    router.refresh();

    // The durable copy (migration 0029), so the answer survives a new phone.
    // Deliberately silent on failure: someone who just answered a question
    // correctly must not be shown an error about our storage. `/danas` merges
    // the stored row over the cookie, so this only ever adds.
    try {
      void Promise.resolve(
        fetch("/api/dani", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dayKey: untrustedDayKey, answer: value }),
        })
      ).catch(() => {
        // Offline, or 0029 not applied in this environment yet.
      });
    } catch {
      // `fetch` missing entirely (older webview, test environment).
    }
  }

  const weekdayNames = t("home.adaptive.weekdays").split(" ");
  const name = weekdayNames[weekdayIndexOf(day.dayKey)] ?? day.dayKey;

  return (
    <div
      data-testid="day-question"
      className="home-body rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm"
    >
      <p className="flex items-start gap-2.5 text-foreground">
        <CircleHelp
          className="size-5 shrink-0 translate-y-px text-primary"
          aria-hidden={true}
        />
        <span>
          {t("home.dayQuestion.ask", {
            day: name,
            kcal: formatNumber(day.kcal),
          })}
        </span>
      </p>
      {/* Both answers are ordinary and neither is "wrong" -- same weight, same
          styling. A primary button here would be the app telling the user
          which of their own days it prefers. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="day-answer-complete"
          onClick={() => answer(day.dayKey, "complete")}
          className="min-h-10 rounded-full border border-border bg-background/60 px-4 text-xs font-medium text-foreground active:scale-[0.97]"
        >
          {t("home.dayQuestion.complete")}
        </button>
        <button
          type="button"
          data-testid="day-answer-partial"
          onClick={() => answer(day.dayKey, "partial")}
          className="min-h-10 rounded-full border border-border bg-background/60 px-4 text-xs font-medium text-foreground active:scale-[0.97]"
        >
          {t("home.dayQuestion.partial")}
        </button>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">
        {t("home.dayQuestion.why")}
      </p>
    </div>
  );
}
