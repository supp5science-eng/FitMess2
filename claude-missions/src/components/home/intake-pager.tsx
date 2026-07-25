"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function IntakePager({
  pages,
  className,
}: {
  pages: IntakePagerPage[];
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const frameRef = useRef<number | null>(null);

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

  function handleScroll() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      syncActive();
    });
  }

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
