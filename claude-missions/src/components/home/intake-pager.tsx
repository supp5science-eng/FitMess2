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
// ## Vertical size follows the finger (2026-07-25 fix)
//
// A plain flex row is as tall as its TALLEST page, which left a big empty gap
// under the short page (reported: a void between the Potrošeno/Preostalo toggle
// and the dots). Snapping the height to the active page instead would clip the
// incoming taller page mid-swipe.
//
// So the height is INTERPOLATED from the scroll position: at 37% between page 1
// and page 2 the container is 37% of the way between their two heights. No
// clipping, no CSS transition to fight the drag, and the dots ride along right
// under the content. Page heights come from a ResizeObserver, so a page that
// grows later (e.g. the coverage note appearing) is picked up automatically.
//
// Before the first measurement the height stays `auto` (SSR and the first paint),
// which degrades to exactly the old behaviour rather than to a collapsed box.

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
  // The interpolated height actually applied; null = not measured yet ("auto").
  const [height, setHeight] = useState<number | null>(null);
  const frameRef = useRef<number | null>(null);

  // Read the scroll position ONCE per frame (a swipe fires scroll events far
  // faster than the screen refreshes) and derive both the dot index and the
  // interpolated height from it.
  const sync = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth ?? 0;
    if (!element || width === 0) return;

    const exact = element.scrollLeft / width;
    const index = Math.max(0, Math.min(pages.length - 1, Math.round(exact)));
    setActive(index);

    const measured = pageRefs.current.map(
      (page, position) => page?.offsetHeight ?? heights[position] ?? 0
    );
    if (measured.every((value) => value === 0)) return;

    const lower = Math.max(0, Math.min(pages.length - 1, Math.floor(exact)));
    const upper = Math.min(pages.length - 1, lower + 1);
    const fraction = Math.max(0, Math.min(1, exact - lower));
    const from = measured[lower] || measured[upper] || 0;
    const to = measured[upper] || from;
    if (from === 0) return;
    setHeight(Math.round(from + (to - from) * fraction));
  }, [pages.length, heights]);

  function handleScroll() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      sync();
    });
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

  // Apply the measured heights (also covers the very first measurement and any
  // later content change while the user isn't scrolling).
  useEffect(() => {
    sync();
  }, [sync]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    []
  );

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
        data-testid="intake-pager"
        className={cn(
          "-mx-6 flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{
          touchAction: "pan-x pan-y",
          // Follows the swipe (see the header comment); `auto` until measured.
          height: height === null ? undefined : height,
          // The interpolated height matches the content exactly, so this only
          // ever hides a sub-pixel rounding sliver -- but without it a 1px
          // shortfall would raise an inner vertical scrollbar.
          overflowY: "hidden",
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
          // `-my-2.5` pulls the row's 44px tap targets back over their own
          // padding: the dots keep a thumb-sized hit area without paying for it
          // in visible whitespace (the gap under the toggle was the complaint).
          className="-my-2.5 mx-auto flex items-center gap-1"
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
