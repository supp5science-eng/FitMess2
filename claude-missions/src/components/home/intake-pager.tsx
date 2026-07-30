"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

// The horizontal, swipeable pager that holds the home tab's "Dnevni unos" block
// (2026-07-25). Page 1 is the calorie ring + macro bars, page 2 Koraci + Voda,
// page 3 the micronutrients + health score. Dots below show where you are and
// jump when tapped.
//
// Built on native CSS scroll-snap rather than a carousel library: it is one
// scroll container, so the swipe has real iOS momentum and rubber-banding for
// free, it works with no JS if hydration is slow, and it adds zero dependencies.
//
// ## The height rule, learned the hard way
//
// THE CONTAINER'S HEIGHT IS NEVER TOUCHED FROM JAVASCRIPT. Do not "improve" this.
//
// A flex row is as tall as its TALLEST page, which left an empty gap under the
// shorter pages. Two attempts to fix that by driving the height from JS both
// produced real, reported bugs: interpolating it from the scroll offset, and then
// snapping it on scroll-settle. Mutating a scroll container's height re-triggers
// the browser's snap/momentum machinery mid-gesture -- the swipe stuck, refused
// to come back, ended up between pages, and generally stopped feeling native.
// No amount of debouncing fixed the class of problem.
//
// The gap is solved in CSS instead, with nothing moving:
//   * pages stretch to a shared height (the flex default -- no `items-start`),
//   * each page's content is a `flex-1` column, so a SHORT page distributes its
//     own slack internally (`justify-between` on that page's root) instead of
//     leaving dead space above the dots.
//
// The only JS left is reading which page is showing, to light the right dot --
// pure state, zero layout mutation.
//
// iOS/mobile notes:
//   * `overscroll-x-contain` stops a horizontal swipe from chaining out into
//     Safari's back-navigation gesture at the first page's edge.
//   * `snap-always` (scroll-snap-stop) keeps one flick from skipping a page, so
//     a fast swipe can never overshoot from page 1 to page 3.
//   * The container is FULL-BLEED (`-mx-6`) with the padding moved onto each
//     page, so a page's content lines up with the rest of the screen while the
//     snap edges sit at the real screen edges.
//   * `touch-action: pan-x pan-y` keeps vertical scrolling of the page itself
//     working while a horizontal drag is in progress.
//   * Scrollbars are hidden the same way the date strip hides them.

export interface IntakePagerPage {
  /** Stable key + the accessible name announced for the page. */
  id: string;
  labelSr: string;
  content: React.ReactNode;
}

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function IntakePager({
  pages,
  className,
}: {
  pages: IntakePagerPage[];
  className?: string;
}) {
  const { t } = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const frameRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);

  // Read the scroll position ONCE per frame (a swipe fires scroll events far
  // faster than the screen refreshes) and light the nearest page's dot. This is
  // the pager's entire JS footprint: no measuring, no style writes, nothing that
  // can perturb the scroll in progress.
  const syncActive = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth ?? 0;
    if (!element || width === 0) return;
    const index = Math.round(element.scrollLeft / width);
    setActive(Math.max(0, Math.min(pages.length - 1, index)));
  }, [pages.length]);

  // Settle-snap: the one defensive correction the native snap can't do on its
  // own (2026-07-30). `scroll-snap-type: x mandatory` only re-snaps when a
  // scroll gesture ends cleanly -- but the pager also allows vertical page
  // panning (`touch-action: pan-x pan-y`), and a DIAGONAL or interrupted flick
  // on iOS can let horizontal momentum die BETWEEN two pages. The scroller then
  // rests off-grid, showing half of one page and half of the next -- the "krivi"
  // (crooked) half-and-half state the product owner reported.
  //
  // This runs ONLY after scrolling has come to rest (the idle timer is reset by
  // every scroll event, so it never fires mid-gesture or mid-momentum and cannot
  // perturb a swipe in progress -- the same reason the header's height rule
  // exists). If the resting position is off the nearest page edge by more than a
  // pixel, it glides to that edge; when already aligned it does nothing, so a
  // programmatic `goTo` (which lands exactly on a page) never re-triggers it.
  const settle = useCallback(() => {
    const element = scrollerRef.current;
    const width = element?.clientWidth ?? 0;
    if (!element || width === 0) return;
    const index = Math.max(
      0,
      Math.min(pages.length - 1, Math.round(element.scrollLeft / width))
    );
    const target = width * index;
    if (Math.abs(element.scrollLeft - target) <= 1) return;
    element.scrollTo({
      left: target,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [pages.length]);

  function handleScroll() {
    if (settleRef.current !== null) {
      window.clearTimeout(settleRef.current);
    }
    settleRef.current = window.setTimeout(() => {
      settleRef.current = null;
      settle();
    }, 140);

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

  function goTo(index: number) {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTo({
      left: element.clientWidth * index,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
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
          "-mx-6 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        // Both axes stay pannable so the page itself still scrolls vertically
        // mid-drag. NOTE: no `height` and no `transition` here, on purpose --
        // see the height rule in the header comment.
        style={{ touchAction: "pan-x pan-y" }}
      >
        {pages.map((page) => (
          <section
            key={page.id}
            data-testid={`intake-page-${page.id}`}
            aria-label={page.labelSr}
            // `flex flex-col` + the row's default stretch is what lets a short
            // page fill the shared height from the inside (its content root is
            // `flex-1`), instead of leaving a void above the dots.
            className="flex w-full shrink-0 snap-center snap-always flex-col px-6"
          >
            {page.content}
          </section>
        ))}
      </div>

      {pages.length > 1 ? (
        <div
          data-testid="intake-pager-dots"
          // Bigger, better-spaced dots (2026-07-29): the active page grows into
          // a rounded PILL, the rest are clear 8px dots -- the modern pager
          // look (Cal-AI-style), replacing the old tiny, low-contrast pair.
          // Each dot keeps a generous tap target (h-9 w-7) pulled back over its
          // own padding (-my-2) so the row costs almost no visible whitespace
          // while staying comfortably tappable.
          className="-my-2 mx-auto flex items-center gap-1.5"
        >
          {pages.map((page, index) => {
            const selected = index === active;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={t("home.pager.show", { label: page.labelSr })}
                aria-current={selected ? "true" : undefined}
                className="flex h-9 w-7 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all duration-300",
                    selected
                      ? "w-5 bg-foreground"
                      : "w-2 bg-foreground/20"
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
