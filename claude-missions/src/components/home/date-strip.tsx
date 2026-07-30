"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import type { DayCell } from "@/lib/home/date-strip";
import type { TFunction } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

// The /danas date picker — a horizontal WHEEL of days under the wordmark
// (2026-07-30 redesign). Days scroll under a small FIXED marker pinned to the
// centre; wherever the scroll settles, that day is selected and the dashboard
// navigates to it. No tap-then-wait: you spin to a day and it lands.
//
// ## Why a wheel, and why it feels instant
//
// The old strip was a row of `<Link>`s: every tap did a full route navigation
// that blanked the WHOLE screen (this strip included) into `loading.tsx`, ran
// ~10 Supabase reads, then re-mounted and re-centred. That is the "presporo"
// the product owner reported. Two things fix it:
//
//   1. This picker now lives in `danas/layout.tsx`, which Next PRESERVES across
//      a `?dan=` change -- so the wheel never unmounts, never flashes, and stays
//      interactive while only the CONTENT below swaps under `loading.tsx`.
//   2. A TAP navigates on the spot (see `goTo`), instead of waiting out the
//      smooth scroll and the settle debounce first.
//
// ## Two things this deliberately does NOT do (2026-07-30 perf fix)
//
//   * **It never prefetches days as they pass under the marker.** It used to,
//     once per animation frame during a swipe. `/danas` is a fully dynamic
//     route, so a prefetch does not warm any DATA -- it just fires a server
//     request that re-runs the whole RSC render (auth + ~8 Supabase reads).
//     Flicking across the wheel therefore kicked off dozens of full renders,
//     saturating the server and the Supabase pool, and the REAL navigation
//     then queued up behind all of them. That is where the multi-second waits
//     came from. The per-frame handler now only lights the centred day.
//   * **It never waits for the scroll to settle before navigating on a tap.**
//     Tap used to: smooth-scroll (~400ms) -> settle debounce (130ms) -> push.
//     That was half a second of dead time before the request even started.
//
// ## The interaction
//
//   * The row is one native scroll-snap container (`snap-x mandatory`), so the
//     swipe has real iOS momentum for free and each day snaps to the centre.
//   * `scroll-padding` is baked in as symmetric `px-[calc(50%-2rem)]`: with 4rem
//     (`w-16`) cells that puts cell `i`'s centre at `scrollLeft = i * cellWidth`,
//     so the index maths is a plain round -- no measuring the marker.
//   * A settle-snap (debounced, fires only once scrolling has come to REST, like
//     the intake pager's) commits the centred day: it corrects any between-days
//     resting position, lights the day, and `router.push`es to it. Landing on a
//     faint FUTURE / pre-sign-up filler day snaps back to the nearest real day
//     instead of navigating nowhere.
//   * Tapping a day scrolls it to the centre, which runs the same settle path.
//   * `touch-action: pan-x` keeps the wheel a crisp horizontal control (a
//     stranded diagonal flick can't leave it between days); the page scrolls
//     from the content area below, not from this thin strip.

// useLayoutEffect on the client (position the scroll before paint -> no
// left-to-center jump), a no-op useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isEnabled(cell: DayCell): boolean {
  return !cell.isFuture && !cell.isBeforeStart;
}

/** The route a (real) day cell navigates to: today -> bare `/danas`. */
function hrefFor(cell: DayCell): string {
  return cell.isToday ? "/danas" : `/danas?dan=${cell.key}`;
}

function accessibleLabel(cell: DayCell, t: TFunction): string {
  const monthsShort = t("home.dateStrip.monthsShort").split(" ");
  const [, month, day] = cell.key.split("-").map(Number);
  const date = `${day}. ${monthsShort[month! - 1]}`;
  if (cell.isToday) return t("home.dateStrip.today", { date });
  return cell.isLogged ? t("home.dateStrip.logged", { date }) : date;
}

// Mini-ring geometry: a 40px box, ring radius/stroke sized so the day number
// stays readable inside. Same pathLength=100 dash technique as the big ring.
const MINI_BOX = 40;
const MINI_CENTER = MINI_BOX / 2;
const MINI_RADIUS = 17;
const MINI_STROKE = 3.5;

function DayCircle({ cell }: { cell: DayCell }) {
  const disabled = cell.isFuture || cell.isBeforeStart;
  const fraction = disabled ? 0 : cell.fillFraction;
  return (
    <span className="relative flex size-10 items-center justify-center">
      <svg
        viewBox={`0 0 ${MINI_BOX} ${MINI_BOX}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Same themed gradient as the big daily ring (`ring.tsx`) via the
              `--gauge-grad-*` tokens (azure on light, brand teal on dark),
              duplicated per-cell -- identical stops, so whichever instance
              the id resolves to renders the same. `var()` only works through
              `style`, not plain SVG attributes. */}
          <linearGradient id="fm-day-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--gauge-grad-1)" }} />
            <stop offset="55%" style={{ stopColor: "var(--gauge-grad-2)" }} />
            <stop offset="100%" style={{ stopColor: "var(--gauge-grad-3)" }} />
          </linearGradient>
        </defs>
        <circle
          cx={MINI_CENTER}
          cy={MINI_CENTER}
          r={MINI_RADIUS}
          fill="none"
          strokeWidth={MINI_STROKE}
          style={{
            stroke: disabled
              ? "color-mix(in srgb, var(--foreground) 8%, transparent)"
              : "var(--gauge-track)",
          }}
        />
        {fraction > 0 ? (
          <circle
            cx={MINI_CENTER}
            cy={MINI_CENTER}
            r={MINI_RADIUS}
            fill="none"
            stroke="url(#fm-day-ring-gradient)"
            strokeWidth={MINI_STROKE}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - fraction * 100}
            transform={`rotate(-90 ${MINI_CENTER} ${MINI_CENTER})`}
          />
        ) : null}
      </svg>
      <span
        className={cn(
          "relative text-sm font-semibold tabular-nums",
          disabled
            ? "text-foreground/30"
            : cell.isToday || cell.isLogged
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {cell.dayNum}
      </span>
    </span>
  );
}

function DayCellInner({
  cell,
  selected,
}: {
  cell: DayCell;
  selected: boolean;
}) {
  const { t } = useT();
  const weekday = t("dow.short").split(" ")[cell.weekdayIndex] ?? cell.dayLabel;
  return (
    <span
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl px-1 py-2 transition-colors",
        selected && "bg-foreground/[0.06] ring-1 ring-foreground/10"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium",
          cell.isToday
            ? // Today's weekday sits in a brand-teal chip, like the
              // highlighted weekday in the reference design.
              "rounded-full bg-[color:var(--brand)] px-2 py-0.5 font-semibold text-[#04231c]"
            : cell.isFuture || cell.isBeforeStart
              ? "text-foreground/30"
              : selected
                ? "text-foreground"
                : "text-muted-foreground"
        )}
      >
        {weekday}
      </span>
      <DayCircle cell={cell} />
    </span>
  );
}

export function DateStrip({
  days,
  todayKey,
}: {
  days: DayCell[];
  /** Belgrade "today" (from the server) -- the default landing day and the
   * upper bound: a `?dan=` after today falls back to it. */
  todayKey: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Which day the URL says we're on (the picker reads this so back/forward and
  // the initial deep-link both centre correctly). Invalid / future -> today.
  const danParam = searchParams.get("dan");
  const selectedKey =
    danParam && /^\d{4}-\d{2}-\d{2}$/.test(danParam) && danParam <= todayKey
      ? danParam
      : todayKey;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);
  // The wheel must NEVER navigate on its own -- only in response to a real user
  // gesture. On load the strip programmatically scrolls itself onto the URL's
  // day; that placement (and any browser back/forward re-centre) fires the same
  // settle path, and without this guard a placement that rested a hair off
  // centre -- or on a slow first layout rested at the far-left oldest day --
  // would `router.push` the app onto the WRONG day (the reported "stavi me na
  // pogrešne datume na početku", sometimes an empty pre-sign-up filler day).
  // Flipped true the moment the user touches the wheel, so genuine swipes and
  // taps still navigate exactly as before.
  const interactedRef = useRef(false);
  const markInteracted = useCallback(() => {
    interactedRef.current = true;
  }, []);
  // The day currently lit under the marker. Starts on the URL's day and is
  // driven by the scroll position from then on.
  const [activeKey, setActiveKey] = useState(selectedKey);

  // The last day we asked the router for. A tap navigates IMMEDIATELY and then
  // smooth-scrolls; when that scroll comes to rest the settle path runs too,
  // and at that moment `selectedKey` may still be the OLD day (the transition
  // hasn't committed yet) -- without this it would fire a second, identical
  // `router.push`.
  const pushedKeyRef = useRef<string | null>(null);
  // Released once the URL actually catches up, so a day whose navigation never
  // landed (dropped request, user backed out) can be tapped again.
  useEffect(() => {
    pushedKeyRef.current = null;
  }, [selectedKey]);

  /** Navigate to a day, at most once per day per transition. */
  const navigateTo = useCallback(
    (cell: DayCell) => {
      if (cell.key === selectedKey || pushedKeyRef.current === cell.key) return;
      pushedKeyRef.current = cell.key;
      // Non-blocking: the wheel stays live while the day's content loads.
      startTransition(() => router.push(hrefFor(cell)));
    },
    [router, selectedKey]
  );

  const indexOfKey = useCallback(
    (key: string) => days.findIndex((cell) => cell.key === key),
    [days]
  );

  // One cell's width, measured live (robust to rem/font scaling) rather than
  // hard-coded, so the index maths tracks the real layout.
  const cellWidth = useCallback(() => {
    const first = scrollerRef.current?.firstElementChild as HTMLElement | null;
    return first?.getBoundingClientRect().width ?? 0;
  }, []);

  const centerIndex = useCallback(
    (index: number, smooth: boolean) => {
      const element = scrollerRef.current;
      const width = cellWidth();
      if (!element || width === 0) return;
      element.scrollTo({
        left: index * width,
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
    },
    [cellWidth]
  );

  // Nearest REAL (tappable) day to a given index -- so a settle that lands on a
  // faint future / pre-sign-up filler day snaps back to a day that exists.
  const nearestEnabledIndex = useCallback(
    (index: number): number | null => {
      if (days[index] && isEnabled(days[index]!)) return index;
      for (let step = 1; step < days.length; step++) {
        const before = index - step;
        const after = index + step;
        if (before >= 0 && days[before] && isEnabled(days[before]!)) {
          return before;
        }
        if (
          after < days.length &&
          days[after] &&
          isEnabled(days[after]!)
        ) {
          return after;
        }
      }
      return null;
    },
    [days]
  );

  // Land ON the URL's day (today by default), centred under the marker, BEFORE
  // the wheel is ever shown -- so entering the app never flashes the oldest day
  // sitting at the far left. The strip is held invisible (`ready`) until it's
  // placed, then revealed. Placement waits a frame if the cells haven't been
  // measured yet (width 0), so it's robust to a slow first layout.
  //
  // `placedRef` is set only once placement has actually FINISHED -- never
  // eagerly on the first run. This effect's deps include `indexOfKey`, whose
  // identity changes whenever the server hands down a fresh `days` array, and on
  // /danas that happens MID-MOUNT: the header streams in the streak pill from a
  // Suspense slot, the layout re-renders, and `days` arrives as a new array.
  // React then runs this effect's CLEANUP -- cancelling the pending placement
  // frame -- before re-running the body. An eager "already mounted" guard made
  // that re-run bail straight out, so `setReady(true)` never fired and the WHOLE
  // wheel stayed at `opacity-0`: the centre marker hanging over a blank strip,
  // not one day visible. Keyed on real completion, a cancelled placement is
  // simply retried by the re-run.
  const placedRef = useRef(false);
  const [ready, setReady] = useState(false);
  useIsomorphicLayoutEffect(() => {
    if (placedRef.current) return;
    let raf = 0;
    const finish = () => {
      placedRef.current = true;
      setReady(true);
    };
    // Failsafe: whatever happens below, the wheel WILL be revealed. Landing
    // centred is a nicety; staying invisible is a broken screen, so the hidden
    // state is time-bound rather than trusting every path to reach `finish()`.
    // The retry chain keeps running after it fires, so a late placement still
    // corrects the scroll position.
    const failsafe = window.setTimeout(finish, 600);
    const place = (attempt: number) => {
      const element = scrollerRef.current;
      if (!element) {
        if (attempt < 8) raf = requestAnimationFrame(() => place(attempt + 1));
        else finish();
        return;
      }
      const index = indexOfKey(selectedKey);
      const width = cellWidth();
      if (index >= 0 && width > 0) {
        element.scrollLeft = index * width;
        finish();
        return;
      }
      // Fallback if a per-cell width read still measures 0 while the browser
      // finishes first layout: centre the selected cell by its own measured
      // offset (no width-math), so a slow layout can never reveal the wheel
      // parked at the far-left oldest day. More frames than before (8 vs 3)
      // also gives layout more time on a heavy first paint.
      const target = element.querySelector<HTMLElement>(
        `[data-day="${selectedKey}"]`
      );
      if (target && target.offsetWidth > 0) {
        element.scrollLeft =
          target.offsetLeft - (element.clientWidth - target.offsetWidth) / 2;
        finish();
        return;
      }
      if (attempt < 8) raf = requestAnimationFrame(() => place(attempt + 1));
      else finish();
    };
    raf = requestAnimationFrame(() => place(0));
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(failsafe);
    };
  }, [cellWidth, indexOfKey, selectedKey]);

  // Re-centre when the day changes from OUTSIDE the wheel (back/forward, a deep
  // link). Keyed on `selectedKey` ALONE on purpose: it must react to a URL
  // change, never to our own `activeKey` update mid-scroll (that would fight the
  // gesture and snap back). Only the DOM scroll is written here; the scroll's
  // settle then lights `activeKey`, so no state is set from the effect body.
  const syncedKeyRef = useRef(selectedKey);
  useEffect(() => {
    if (selectedKey === syncedKeyRef.current) return;
    syncedKeyRef.current = selectedKey;
    const index = indexOfKey(selectedKey);
    if (index >= 0) centerIndex(index, true);
  }, [selectedKey, indexOfKey, centerIndex]);

  // Settle-snap: fires only once scrolling has come to REST (the timer is reset
  // by every scroll event, so it never runs mid-gesture or mid-momentum). It
  // corrects a between-days resting position, lights the centred real day, and
  // navigates to it. Same defensive shape as the intake pager's settle.
  const settle = useCallback(() => {
    const element = scrollerRef.current;
    const width = cellWidth();
    if (!element || width === 0) return;
    const raw = Math.max(
      0,
      Math.min(days.length - 1, Math.round(element.scrollLeft / width))
    );
    const index = nearestEnabledIndex(raw);
    if (index == null) return;
    const cell = days[index]!;
    if (Math.abs(element.scrollLeft - index * width) > 1) {
      centerIndex(index, true);
    }
    setActiveKey(cell.key);
    // Gated on `interactedRef`: a settle triggered by the initial placement
    // or an external re-centre (not a user gesture) only lights the day, it
    // never navigates -- so the app can never boot onto the wrong day.
    if (interactedRef.current) navigateTo(cell);
  }, [cellWidth, days, nearestEnabledIndex, centerIndex, navigateTo]);

  // Per-frame during a swipe: light the centred day. Pure reads, no layout
  // writes, and -- deliberately -- NO `router.prefetch` (see the header note):
  // prefetching a dynamic route per frame bought nothing and cost a full server
  // render per day scrolled past.
  const syncActive = useCallback(() => {
    const element = scrollerRef.current;
    const width = cellWidth();
    if (!element || width === 0) return;
    const index = Math.max(
      0,
      Math.min(days.length - 1, Math.round(element.scrollLeft / width))
    );
    const cell = days[index];
    if (cell && isEnabled(cell)) setActiveKey(cell.key);
  }, [cellWidth, days]);

  function handleScroll() {
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      settleRef.current = null;
      settle();
    }, 90);

    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      syncActive();
    });
  }

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    },
    []
  );

  // Tapping a day navigates STRAIGHT AWAY and centres the wheel in parallel.
  // (It used to only scroll, and let the settle -- 130ms after the ~400ms
  // smooth scroll finished -- do the pushing, so every tap paid ~half a second
  // before the request even left the device.) The settle still runs when the
  // scroll rests, but `navigateTo` dedupes it, so this is one navigation.
  function goTo(cell: DayCell) {
    const index = indexOfKey(cell.key);
    if (index < 0) return;
    // A tap is an explicit user action -- arm navigation so a later settle
    // (e.g. the user then flicks the wheel) pushes too.
    interactedRef.current = true;
    setActiveKey(cell.key);
    navigateTo(cell);
    centerIndex(index, true);
  }

  return (
    <div className="relative -mx-6">
      {/* The small FIXED marker: a caret pinned to the centre that the days
          scroll under, so it always shows "where we are". Purely decorative
          (the lit cell + its aria-current carry the state). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2"
      >
        <span className="block size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-foreground/40" />
      </span>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        // Any of these is a real user grabbing the wheel -- it arms navigation
        // so a settle actually pushes. Programmatic placement/re-centre fires
        // none of them, so the app never navigates itself onto the wrong day.
        onPointerDown={markInteracted}
        onTouchStart={markInteracted}
        onMouseDown={markInteracted}
        onWheel={markInteracted}
        onKeyDown={markInteracted}
        data-testid="date-strip"
        aria-label={t("home.dateStrip.aria")}
        role="navigation"
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pt-2.5",
          "px-[calc(50%-2rem)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Held invisible until centred on the selected day, so entering the
          // app never flashes the far-left (oldest) day before the jump.
          "transition-opacity duration-150",
          ready ? "opacity-100" : "opacity-0"
        )}
        // A crisp horizontal control: only pan-x, so a diagonal flick can't
        // strand the wheel between days. The page scrolls from the content
        // below, not this thin strip.
        style={{ touchAction: "pan-x" }}
      >
        {days.map((cell) => {
          const enabled = isEnabled(cell);
          const selected = enabled && cell.key === activeKey;

          return enabled ? (
            <button
              key={cell.key}
              type="button"
              data-day={cell.key}
              onClick={() => goTo(cell)}
              aria-label={accessibleLabel(cell, t)}
              aria-current={selected ? "page" : undefined}
              className="w-16 shrink-0 snap-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <DayCellInner cell={cell} selected={selected} />
            </button>
          ) : (
            <div
              key={cell.key}
              data-day={cell.key}
              className="w-16 shrink-0 snap-center"
              aria-hidden="true"
            >
              <DayCellInner cell={cell} selected={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
