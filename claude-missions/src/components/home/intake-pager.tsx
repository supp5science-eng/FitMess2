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
// Vertical size: pages sit in a `items-start` flex row, so the pager is as tall
// as the TALLEST page and nothing jumps as you swipe between them.

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
  // Guards the dots against fighting a programmatic scroll in progress.
  const frameRef = useRef<number | null>(null);

  const syncActive = useCallback(() => {
    const element = scrollerRef.current;
    if (!element || element.clientWidth === 0) return;
    const index = Math.round(element.scrollLeft / element.clientWidth);
    setActive(Math.max(0, Math.min(pages.length - 1, index)));
  }, [pages.length]);

  // rAF-throttled: a swipe fires scroll events far faster than we need to move
  // a dot.
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
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        data-testid="intake-pager"
        className={cn(
          "-mx-6 flex snap-x snap-mandatory items-start overflow-x-auto overscroll-x-contain",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        style={{ touchAction: "pan-x pan-y" }}
      >
        {pages.map((page, index) => (
          <section
            key={page.id}
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
          className="mx-auto flex items-center gap-2"
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
