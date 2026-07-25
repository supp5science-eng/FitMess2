"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// The horizontal, swipeable pager that holds the home tab's "Dnevni unos" block
// (2026-07-25). Page 1 is the calorie ring + macro bars exactly as before; page
// 2, reached by swiping right, carries the four micronutrient cards and the
// health score. Dots below show where you are and jump when tapped.
//
// Built on native CSS scroll-snap rather than a carousel library: it is one
// scroll container, so the swipe has real iOS momentum and rubber-banding for
// free, it works with no JS if hydration is slow, and it adds zero dependencies.
// The only JS is reading which page is showing (for the dots) and scrolling on a
// dot tap.
//
// iOS/mobile notes:
//   * `overscroll-x-contain` stops a horizontal swipe from chaining out into
//     Safari's back-navigation gesture at the first page's edge.
//   * The container is FULL-BLEED (`-mx-6`) with the padding moved onto each
//     page, so a page's content lines up with the rest of the screen while the
//     snap edges sit at the real screen edges -- otherwise the second page peeks
//     in at rest.
//   * `touch-action: pan-x pan-y` keeps vertical scrolling of the page itself
//     working while a horizontal drag is in progress.
//   * Scrollbars are hidden the same way the date strip hides them.
//
// ## Vertical size: tallest while moving, exact once it lands
//
// A plain flex row is as tall as its TALLEST page, which left a big empty gap
// under the shorter page (reported: a void between the Potrošeno/Preostalo
// toggle and the dots). So the height has to change per page -- but WHEN it
// changes turns out to matter more than the value.
//
// The first attempt interpolated the height continuously from the scroll offset.
// It looked right on paper and broke in the hand: mutating a scroll container's
// height while a snap scroll is in flight makes the browser re-evaluate its snap
// positions mid-gesture, so swiping to the second page stuck, bounced, or left
// the dots disagreeing with what was on screen.
//
// The rule now: NOTHING moves while the finger is down. During any scroll the
// pager holds the tallest page's height (so no page is clipped and the snap
// engine sees a stable box); when the scroll settles it eases to the height of
// the page the user landed on. Costs one short animation after the swipe and
// removes a whole class of gesture bugs.
//
// Page heights come from a ResizeObserver, so a page that grows later (a new
// coverage note, a "Cilj 🎉" badge, a longer score sentence) is picked up
// automatically. Before the first measurement the height stays `auto` (SSR and
// first paint), degrading to the plain tallest-page behaviour, never to a
// collapsed box.

export interface IntakePagerPage {
  /** Stable key + the accessible name announced for the page. */
  id: string;
  labelSr: string;
  content: React.ReactNode;
}

export function IntakePager({
  pages,
  className,
}: {
  pages: IntakePagerPage[];
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  // Measured content height of each page, in page order. Empty until the first
  // ResizeObserver callback, which is what keeps the height `auto` on first paint.
  const [heights, setHeights] = useState<number[]>([]);
  // True from the first scroll event until the scroll settles. While it's true
  // the pager holds the TALLEST height (see the header comment): the height must
  // not move under the user's finger.
  const [scrolling, setScrolling] = useState(false);
  const frameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read the scroll position ONCE per frame (a swipe fires scroll events far
  // faster than the screen refreshes) and move the dot to the nearest page.
  const syncActive = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth ?? 0;
    if (!element || width === 0) return;
    const index = Math.round(element.scrollLeft / width);
    setActive(Math.max(0, Math.min(pages.length - 1, index)));
  }, [pages.length]);

  function handleScroll() {
    setScrolling(true);
    // Settle detection: iOS fires no reliable "scroll ended" event for a
    // momentum swipe on every version, so we treat "no scroll event for a
    // moment" as settled. `scrollend` (where supported) makes this snappier.
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setScrolling(false), 220);

    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      syncActive();
    });
  }

  function handleScrollEnd() {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    syncActive();
    setScrolling(false);
  }

  // Track each page's content height. Fires once on mount (so the initial height
  // is the FIRST page's, not the tallest) and again whenever a page's content
  // changes -- a new coverage note, a "Cilj 🎉" badge, a longer score sentence.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const next = pageRefs.current.map((page) => page?.offsetHeight ?? 0);
      setHeights((previous) =>
        previous.length === next.length &&
        previous.every((value, index) => value === next[index])
          ? previous
          : next
      );
    });
    for (const page of pageRefs.current) {
      if (page) observer.observe(page);
    }
    return () => observer.disconnect();
  }, [pages.length]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    []
  );

  // The height actually applied. While the user is scrolling it is the tallest
  // page (so nothing is clipped and, crucially, nothing MOVES mid-swipe); once
  // the scroll settles it eases down to the page they landed on. `undefined`
  // before the first measurement, i.e. plain auto height.
  const measuredMax = heights.length > 0 ? Math.max(...heights) : 0;
  const activeHeight = heights[active] ?? 0;
  const appliedHeight =
    measuredMax <= 0
      ? undefined
      : scrolling
        ? measuredMax
        : activeHeight || measuredMax;

  function goTo(index: number) {
    const element = scrollerRef.current;
    if (!element) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({
      left: element.clientWidth * index,
      behavior: reduced ? "auto" : "smooth",
    });
    // Move the dot immediately; the scroll handler will confirm it.
    setActive(index);
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onScrollEnd={handleScrollEnd}
        data-testid="intake-pager"
        className={cn(
          "-mx-6 flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{
          touchAction: "pan-x pan-y",
          height: appliedHeight,
          // `overflow-x: auto` forces this axis to compute to `auto` if left
          // `visible`, which would raise an inner vertical scrollbar whenever a
          // page is taller than the box. Hidden instead -- and since the applied
          // height is the TALLEST page for the whole duration of a scroll,
          // nothing is ever actually cut off while moving.
          overflowY: "hidden",
          // Only animate the settle. Never during the scroll: a transition
          // running against the finger is what made the second page feel broken.
          transition: scrolling ? undefined : "height 220ms ease-out",
        }}
      >
        {pages.map((page, index) => (
          <section
            key={page.id}
            ref={(element) => {
              pageRefs.current[index] = element;
            }}
            data-testid={`intake-page-${page.id}`}
            aria-label={page.labelSr}
            className="w-full shrink-0 snap-center px-6"
            // Only the visible page should be reachable by a swipe of the
            // screen reader's focus order in practice, but hiding the other page
            // outright would break the (native) scroll-snap navigation, so both
            // stay in the tree -- each is a labelled <section> the user can move
            // through deliberately.
            data-page-index={index}
          >
            {page.content}
          </section>
        ))}
      </div>

      {pages.length > 1 ? (
        <div
          data-testid="intake-pager-dots"
          // The row's tap targets are 44px (iOS) around a small visual dot, so
          // pull it back over its own padding -- a thumb-sized hit area without
          // paying for it in visible whitespace. Kept at -my-2 rather than
          // tighter so the targets can't overlap what sits above/below and steal
          // its taps.
          className="-my-2 mx-auto flex items-center gap-0.5"
        >
          {pages.map((page, index) => {
            const selected = index === active;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Prikaži: ${page.labelSr}`}
                aria-current={selected ? "true" : undefined}
                // 44px tap target (iOS) around a small visual dot.
                className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "block rounded-full transition-all duration-200",
                    selected
                      ? "size-2 bg-foreground"
                      : "size-1.5 bg-muted-foreground/40"
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
