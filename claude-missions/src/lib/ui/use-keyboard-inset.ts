"use client";

import { useEffect, useState } from "react";

/**
 * How much of the viewport the on-screen keyboard is currently covering —
 * live, in CSS pixels — so the composer can sit exactly on top of it.
 *
 * ## Why this has to exist
 *
 * On the web the software keyboard is not part of the layout. It slides over
 * the page, and the page is never told. `position: fixed; bottom: 0` therefore
 * puts the composer *underneath* the keyboard, which is precisely the bug this
 * fixes. The only thing that does see the keyboard is the **visual viewport** —
 * the part of the layout viewport actually visible to the user — exposed as
 * `window.visualViewport`.
 *
 * The gap between the two viewports is the keyboard:
 *
 * ```
 *   window.innerHeight            layout viewport (never shrinks on iOS)
 * - visualViewport.height         what the user can actually see
 * - visualViewport.offsetTop      how far the visual viewport was pushed down
 * = keyboard height
 * ```
 *
 * ## The three shells this has to survive
 *
 * - **Browser tab.** Works as described. Browser chrome (a collapsing URL bar)
 *   can produce a small phantom gap, which `MIN_INSET_PX` absorbs.
 * - **Installed PWA (iOS standalone).** The case this was written for. There is
 *   no browser chrome, the layout viewport genuinely never moves, and the
 *   formula is exact.
 * - **Capacitor shell (`android/`, `ios/`).** Depending on the shell's resize
 *   mode the *web view itself* may shrink when the keyboard opens. Then
 *   `window.innerHeight` shrinks in step with `visualViewport.height`, the gap
 *   is 0, and this hook correctly reports 0 — the layout has already been made
 *   correct by the platform and adding an inset on top would push the composer
 *   into mid-screen. Nothing to special-case: the same arithmetic gives the
 *   right answer in both modes.
 *
 * Where `window.visualViewport` does not exist at all (old WebViews, jsdom,
 * server rendering) the hook reports a closed keyboard forever and never
 * throws. Every consumer degrades to today's behaviour.
 *
 * ## Why this does not re-render on every animation frame
 *
 * The keyboard slides in over ~250 ms and fires a burst of `resize`/`scroll`
 * events while it does. Re-rendering the composer subtree on each one is 60
 * React renders a second for a purely visual translation, so the live value
 * never goes through React at all:
 *
 * - The **live** height is written to the `--fm-keyboard-inset` custom property
 *   on `<html>`, at most once per animation frame. Style-only; no render, no
 *   reconciliation. Anything using {@link KEYBOARD_BOTTOM_OFFSET} follows the
 *   keyboard frame-for-frame for free.
 * - **React state** advances only twice per keyboard transition: once when the
 *   keyboard crosses open/closed (so a caller can hide the bottom nav straight
 *   away) and once when the height stops changing, `SETTLE_MS` later.
 *
 * So `height` is the *settled* height — right for logic and layout decisions —
 * while the CSS variable is the *smooth* one, right for positioning.
 *
 * ## Safe area: combined, never doubled
 *
 * With the keyboard **closed**, the composer must clear the home indicator:
 * that is `env(safe-area-inset-bottom)`. With the keyboard **open**, the
 * keyboard is drawn over the home indicator and the measured height already
 * spans it — adding the safe area on top would leave a ~34 px dead band above
 * the keys. The two are therefore combined with `max()`, not `+`:
 *
 * ```css
 * max(env(safe-area-inset-bottom, 0px), var(--fm-keyboard-inset, 0px))
 * ```
 *
 * Closed, the keyboard term is 0 and the safe area wins. Open, the keyboard
 * term (never below `MIN_INSET_PX`) wins and the safe area is already inside
 * it. That expression is exported as {@link KEYBOARD_BOTTOM_OFFSET} and handed
 * back on every result, so no caller has to re-derive it.
 *
 * @example
 * ```tsx
 * const { height, isOpen, bottomOffset } = useKeyboardInset();
 *
 * return (
 *   <>
 *     {isOpen ? null : <AppNavBar />}
 *     <div className="fixed inset-x-0 bottom-0" style={{ paddingBottom: bottomOffset }}>
 *       <Composer />
 *     </div>
 *   </>
 * );
 * ```
 */

/**
 * The custom property carrying the live keyboard height, set on
 * `document.documentElement` while any consumer of the hook is mounted.
 *
 * Exported so a stylesheet can read it directly; prefer
 * {@link KEYBOARD_BOTTOM_OFFSET}, which already folds in the safe area.
 */
export const KEYBOARD_INSET_VAR = "--fm-keyboard-inset";

/**
 * The bottom offset to give a keyboard-anchored element: the safe area when
 * the keyboard is closed, the keyboard when it is open, never the sum of the
 * two. See the "Safe area" section above for why this is `max()`.
 */
export const KEYBOARD_BOTTOM_OFFSET = `max(env(safe-area-inset-bottom, 0px), var(${KEYBOARD_INSET_VAR}, 0px))`;

/**
 * The keyboard's height ALONE — for a composer whose column already carries
 * the home-indicator clearance itself.
 *
 * {@link KEYBOARD_BOTTOM_OFFSET} folds the safe area in because it assumes the
 * anchored element is the only thing standing between the composer and the
 * bottom of the screen. A column that already pads itself by
 * `env(safe-area-inset-bottom)` is not that case: a composer using the `max()`
 * expression adds the safe area a SECOND time and floats ~34 px above the keys
 * — the dead band this pair of constants exists to close. Pair this with
 * {@link KEYBOARD_SAFE_AREA_REMAINDER} on the column and the two add up to
 * exactly `max(safe, keyboard)`, once.
 */
export const KEYBOARD_ONLY_OFFSET = `var(${KEYBOARD_INSET_VAR}, 0px)`;

/**
 * The home-indicator clearance a column should carry when something INSIDE it
 * is riding the keyboard with {@link KEYBOARD_ONLY_OFFSET}: the safe area,
 * minus however much of it the keyboard is already covering, never negative.
 *
 * Keyboard closed, the keyboard term is 0 and this is the plain safe area.
 * Keyboard open, the keys are drawn over the home indicator — the clearance is
 * already inside the keyboard's own height — so this falls to 0 and the
 * composer's offset is the whole story. Neither half ever double-counts.
 */
export const KEYBOARD_SAFE_AREA_REMAINDER = `max(calc(env(safe-area-inset-bottom, 0px) - var(${KEYBOARD_INSET_VAR}, 0px)), 0px)`;

/**
 * Gaps smaller than this are not a keyboard.
 *
 * In a plain browser tab the collapsing URL bar, rubber-band scrolling and
 * sub-pixel rounding all leave the two viewports a few dozen pixels apart with
 * no keyboard anywhere. Every software keyboard on every phone is far taller
 * than this, so the floor costs nothing real and keeps the composer from
 * twitching upward while the user merely scrolls.
 */
const MIN_INSET_PX = 44;

/**
 * How long the height must hold still before it is published to React.
 *
 * Comfortably shorter than the keyboard's own slide (~250 ms on iOS), so the
 * settled value lands as the animation ends rather than after a visible pause.
 */
const SETTLE_MS = 120;

export type KeyboardInset = {
  /**
   * Settled keyboard height in CSS pixels; `0` when the keyboard is closed or
   * the platform cannot tell us. Use it for decisions ("is there room for the
   * nav bar"), not for the composer's own offset — {@link bottomOffset} tracks
   * the slide, this only catches up when it ends.
   */
  height: number;
  /** Whether the keyboard is currently covering part of the viewport. */
  isOpen: boolean;
  /**
   * Ready-to-use CSS length for the element's bottom padding or offset.
   * Constant — it resolves against the live custom property at paint time.
   */
  bottomOffset: string;
};

const CLOSED: KeyboardInset = {
  height: 0,
  isOpen: false,
  bottomOffset: KEYBOARD_BOTTOM_OFFSET,
};

/**
 * The arithmetic, on its own, so it can be tested without a browser.
 *
 * @param viewport `window.visualViewport`, or nothing at all on a platform
 *   that does not have it.
 * @param layoutHeight `window.innerHeight` — the layout viewport.
 * @returns the covered height in whole pixels, or `0` for "no keyboard".
 */
export function measureKeyboardInset(
  viewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined,
  layoutHeight: number
): number {
  if (!viewport) return 0;

  const covered = layoutHeight - viewport.height - viewport.offsetTop;

  // `< MIN_INSET_PX` also catches NaN and the negative values that
  // over-scrolling past the top of the page produces.
  if (!(covered >= MIN_INSET_PX)) return 0;

  return Math.round(covered);
}

/**
 * How many mounted hooks are currently driving {@link KEYBOARD_INSET_VAR}.
 *
 * Several screens can hold the hook at once (a composer and the shell around
 * it). They all write the same value, so the writes are harmless — but the
 * *last* one to unmount has to clear the property, and no earlier one may.
 */
let activeSubscribers = 0;

export function useKeyboardInset(): KeyboardInset {
  const [inset, setInset] = useState<KeyboardInset>(CLOSED);

  useEffect(() => {
    const viewport =
      typeof window === "undefined" ? null : window.visualViewport;

    // No visual viewport: the keyboard is invisible to us. Stay closed, leave
    // the custom property undefined so `var(…, 0px)` falls back, and let every
    // consumer render exactly as it did before this hook existed.
    if (!viewport) return;

    activeSubscribers += 1;
    const root = document.documentElement;

    /** Last value written to the custom property. `-1` forces the first write. */
    let live = -1;
    /** Last value handed to React, so a repeat never re-renders. */
    let committed = 0;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const commit = (next: number) => {
      if (next === committed) return;
      committed = next;
      setInset(
        next === 0
          ? CLOSED
          : { height: next, isOpen: true, bottomOffset: KEYBOARD_BOTTOM_OFFSET }
      );
    };

    const measure = () => {
      frame = 0;

      const next = measureKeyboardInset(viewport, window.innerHeight);
      if (next === live) return;

      const wasOpen = live > 0;
      live = next;

      // The cheap write: style only, so the composer tracks the slide without
      // React hearing about it.
      root.style.setProperty(KEYBOARD_INSET_VAR, `${next}px`);

      // Crossing open/closed is worth an immediate render — that is when a
      // caller swaps the bottom nav for the composer, and waiting SETTLE_MS
      // would show the nav bar sliding under a keyboard that is already up.
      if (wasOpen !== next > 0) {
        commit(next);
      }

      if (settle !== undefined) clearTimeout(settle);
      settle = setTimeout(() => {
        settle = undefined;
        commit(live);
      }, SETTLE_MS);
    };

    /**
     * Coalesce the event burst: the keyboard fires `resize` and `scroll`
     * together, and several of each can land inside one frame.
     */
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(measure);
    };

    // The keyboard can already be up when this mounts (navigating between
    // screens with the field focused), so take a reading before any event.
    measure();

    viewport.addEventListener("resize", schedule);
    // iOS scrolls the visual viewport rather than resizing it once the
    // keyboard is up and the focused field is chased into view; `offsetTop`
    // moves and the gap changes with it.
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
      if (settle !== undefined) clearTimeout(settle);

      activeSubscribers -= 1;
      if (activeSubscribers === 0) {
        root.style.removeProperty(KEYBOARD_INSET_VAR);
      }
    };
  }, []);

  return inset;
}
