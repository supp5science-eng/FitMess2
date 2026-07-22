"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// A small count-up primitive for the `/danas` dashboard. It tweens the shown
// number ONLY when the caller's `animateKey` changes (the Potrošeno/Preostalo
// toggle) -- a plain value change with the same key (e.g. a meal edited/deleted
// in place) snaps SYNCHRONOUSLY during render, so the number stays correct the
// instant the data changes. On first mount it shows the value as-is (no count
// from zero on every page load), and it snaps under `prefers-reduced-motion`.

// useLayoutEffect on the client (start the tween before the browser paints, so
// the target never flashes), a no-op useEffect on the server (avoids the SSR
// warning) -- same pattern the home screen uses for its intro measure.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Default tween length, matched to the ring arc's 0.5s stroke transition so
 * the number and the ring settle together. */
const DEFAULT_DURATION_MS = 500;

/** Ease-out cubic: fast start, gentle settle -- reads as a number "landing". */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Returns a value that animates toward `target`, but only when `animateKey`
 * changes (a plain `target` change with an unchanged key snaps to `target`
 * during render -- no lag). Interruptible: if it changes mid-tween, the next
 * tween starts from wherever the current animation had reached.
 */
export function useCountUp(
  target: number,
  animateKey?: string | number,
  durationMs: number = DEFAULT_DURATION_MS
): number {
  // Non-null only WHILE a tween is running; the rest of the time the hook
  // returns `target` straight from the render (so snaps have zero lag).
  const [tween, setTween] = useState<number | null>(null);
  // The latest value actually shown -- the start point for the next tween.
  const currentRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const lastKeyRef = useRef(animateKey);

  useIsomorphicLayoutEffect(() => {
    // First mount: adopt the value, never animate from anything.
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastKeyRef.current = animateKey;
      currentRef.current = target;
      return;
    }

    const keyChanged = lastKeyRef.current !== animateKey;
    lastKeyRef.current = animateKey;

    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = currentRef.current;
    // Only the deliberate view switch (animateKey change) tweens; everything
    // else -- a meal edited/deleted in place, reduced motion, no real change --
    // snaps (render already shows `target`; just clear any leftover tween).
    if (!keyChanged || reduced || from === target) {
      currentRef.current = target;
      setTween(null);
      return;
    }

    // Show the start value before the browser paints, then animate to target.
    currentRef.current = from;
    setTween(from);
    // Anchor time to the FIRST frame's own timestamp so start and elapsed share
    // one clock (mixing performance.now() with the rAF timestamp can go
    // negative and blow the tween up).
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      const value = from + (target - from) * easeOutCubic(t);
      currentRef.current = value;
      if (t < 1) {
        setTween(value);
        rafRef.current = requestAnimationFrame(step);
      } else {
        currentRef.current = target;
        setTween(null);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, animateKey, durationMs]);

  return tween ?? target;
}

/**
 * Renders a count-up integer inside a `<span>`. Extra props (className,
 * data-testid, …) pass straight through, so it drops in wherever a plain
 * number span used to sit.
 */
export function AnimatedNumber({
  value,
  animateKey,
  durationMs,
  ...spanProps
}: {
  value: number;
  /** Tween only fires when this changes (the view toggle passes `view`). */
  animateKey?: string | number;
  durationMs?: number;
} & React.HTMLAttributes<HTMLSpanElement>) {
  const shown = useCountUp(value, animateKey, durationMs);
  return <span {...spanProps}>{Math.round(shown)}</span>;
}
