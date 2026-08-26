"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AudioLines,
  ChevronUp,
  MessageSquare,
  Settings,
  X,
} from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { pulse } from "@/lib/feel/haptic";
import type { MessageKey } from "@/lib/i18n/messages";
import { isPullArmed, pullProgress } from "@/lib/ui/pull-to-exit";
import { cn } from "@/lib/utils";

import "./jarvis-top-bar.css";

/**
 * Jarvis's top bar — the chrome above the `/ai` screen (2026-08-26 redesign).
 *
 * Three pieces, the Perplexity mobile layout: a round button out to profile &
 * settings, the two-mode segmented control in the middle, and the exit back
 * out to the app. That right-hand exit is NOT decoration: the bottom
 * navigation is hidden on this screen, so in an installed PWA (no browser
 * chrome, no back button) it is the only way out of Jarvis — which is exactly
 * why it is a PULL and not a tap. See `PullToExit` below.
 *
 * Both round buttons get their volume from `.liquid-glass` and their lift from
 * `jarvis-top-bar.css`, NOT from `.fm-lift` — that file opens with the reason,
 * and it is the difference between a disc and a deflated ball.
 *
 * The segmented control is a real control, not two links: `role="tablist"`
 * with two `role="tab"` buttons, roving tabindex, and left/right arrows moving
 * between the segments — so the mode switch is one Tab stop, and the screen
 * reader announces which mode is selected.
 *
 * The active segment is a sliding `bg-card` pill rather than two buttons that
 * merely recolour, following the same measured-indicator pattern as
 * `components/shell/bottom-nav.tsx`: positions are measured (never
 * percentage-guessed, since the label widths differ), re-measured through a
 * `ResizeObserver`, the slide transition is armed only after the first
 * committed position (`ready`) so the pill never flies in from the left on
 * load, and it collapses to a plain fade under `prefers-reduced-motion`.
 */

export type JarvisMode = "voice" | "chat";

const MODES: {
  mode: JarvisMode;
  labelKey: MessageKey;
  Icon: typeof AudioLines;
}[] = [
  { mode: "voice", labelKey: "jarvis.mode.voice", Icon: AudioLines },
  { mode: "chat", labelKey: "jarvis.mode.chat", Icon: MessageSquare },
];

/** True when the user asked for reduced motion (kept live via matchMedia). */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

/**
 * Shared shape of the two round chrome buttons flanking the segments.
 *
 * Keeps the `border` every card here uses and drops only `fm-lift`: the hard
 * offset was what made the circle read as squashed, the hairline was never the
 * problem, and a white disc on white paper needs an edge to be a shape at all.
 * `liquid-glass` + `jtb-round` then light it from the inside and lift it
 * without drawing a contact patch — `jarvis-top-bar.css` carries that argument.
 */
const ROUND_BUTTON_CLASS = cn(
  "jtb-round liquid-glass relative flex size-10 shrink-0 items-center justify-center",
  "rounded-full border border-border bg-card text-foreground transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
);

/** Where the exit lands: the app's home screen. */
const EXIT_HREF = "/danas";

export function JarvisTopBar({
  mode,
  onModeChange,
  className,
}: {
  mode: JarvisMode;
  onModeChange: (mode: JarvisMode) => void;
  className?: string;
}): React.JSX.Element {
  const { t } = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const activeIndex = Math.max(
    0,
    MODES.findIndex((item) => item.mode === mode),
  );

  // Measure the active segment's box relative to the tablist and park the pill
  // over it. Re-measures on mode change and whenever the bar is resized (a
  // rotation, or the safe-area width changing between devices).
  useLayoutEffect(() => {
    function measure() {
      const list = listRef.current;
      const el = tabRefs.current[activeIndex];
      if (!list || !el) return;
      const listRect = list.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ x: elRect.left - listRect.left, width: elRect.width });
    }
    measure();

    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex]);

  // Arm the slide only after the first position is committed, so the pill
  // renders in place instead of sliding in from x=0 on the first paint.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const slide = ready && !reduceMotion;

  // Left/right arrows walk the segments and carry focus with them (roving
  // tabindex), the way a tablist is expected to behave.
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + delta + MODES.length) % MODES.length;
    onModeChange(MODES[next]!.mode);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      data-testid="jarvis-top-bar"
      // `px-4` is not decoration: the bar had NO horizontal padding, so both
      // round buttons sat flush against the edge of the app column while every
      // other row on this screen (composer `px-4`, thread `px-5`) stands clear
      // of it. A bordered button hid that; a borderless one bleeds off.
      className={cn("flex h-10 items-center gap-2 px-4", className)}
    >
      <Link
        href="/profil"
        aria-label={t("jarvis.settings")}
        className={ROUND_BUTTON_CLASS}
      >
        <Settings className="size-4.5" aria-hidden="true" />
      </Link>

      <div
        ref={listRef}
        role="tablist"
        aria-label={t("jarvis.mode.switch")}
        className="relative flex h-10 min-w-0 flex-1 items-stretch rounded-full bg-muted p-1"
      >
        {/* The sliding pill behind the active segment (decorative). */}
        <span
          aria-hidden="true"
          data-testid="jarvis-mode-indicator"
          className="fm-lift pointer-events-none absolute left-0 top-1 bottom-1 rounded-full bg-card"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.x}px)`,
            opacity: indicator.width > 0 ? 1 : 0,
            transition: slide
              ? "transform 320ms cubic-bezier(0.34, 1.4, 0.5, 1), width 320ms cubic-bezier(0.34, 1.4, 0.5, 1), opacity 200ms ease"
              : "opacity 200ms ease",
          }}
        />

        {MODES.map(({ mode: itemMode, labelKey, Icon }, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={itemMode}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              data-testid={`jarvis-mode-${itemMode}`}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => onModeChange(itemMode)}
              onKeyDown={handleKeyDown}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3",
                "text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <PullToExit />
    </div>
  );
}

/**
 * The way out of Jarvis: pull the button up until it is fully red, let go.
 *
 * A tap would be one stray thumb away from throwing the user off a screen they
 * are mid-sentence on, and on this screen there is no second way back — the
 * bottom navigation is hidden and an installed PWA has no browser chrome. A
 * gesture with a distance to it cannot be performed by accident, and the fill
 * says how close it is the whole way, so nobody has to learn where the
 * threshold is: full red means letting go leaves.
 *
 * Three details that are load-bearing rather than decorative:
 *
 * - **The progress never enters React.** It is written onto the node as the
 *   `--jtb-pull` custom property, once per pointer event; only the ARMED flip
 *   is state, because that is the only thing the markup changes (the icon, and
 *   what the live region says). Dragging re-renders nothing.
 * - **The red rises, it does not fade in.** The fill climbs the button from
 *   the bottom as the pull goes up, so the control reads as filling rather
 *   than merely tinting — the level IS the progress, and full is the point
 *   where letting go acts. A buzz lands on that crossing.
 * - **A tap leaves too.** An earlier cut made the pull the ONLY way out, so
 *   that leaving could never happen by accident. In the owner's hands that
 *   read as a broken button, which is the worse failure by a distance: a
 *   control that does nothing when pressed is indistinguishable from one that
 *   is broken, and this is the only door on the screen. So the plain `<a href>`
 *   works — tap, Enter, Space, or no hydration at all — and the pull is an
 *   accelerator on top of it, not a gate in front of it.
 */
function PullToExit(): React.JSX.Element {
  const { t } = useT();
  const router = useRouter();
  const nodeRef = useRef<HTMLAnchorElement>(null);
  /** Where the finger went down; `null` whenever no drag is in flight. */
  const startY = useRef<number | null>(null);
  /** Live progress, mirrored in a ref so pointerup can read it without state. */
  const progress = useRef(0);
  /** Set when a completed pull already navigated, so the click it is followed
   *  by does not navigate a second time. */
  const consumed = useRef(false);
  const [armed, setArmed] = useState(false);

  // `data-dragging` belongs to the pointer handlers, and is deliberately not
  // also declared in the JSX below: one attribute, one owner. (React leaves a
  // constant literal alone on re-render, so declaring it would work today --
  // but it would read as though render owned it, and it would genuinely
  // clobber the gesture the day the value became dynamic.) Absent, it reads as
  // its resting state in the stylesheet, which is right for a button nobody is
  // touching.

  function applyProgress(next: number) {
    const wasArmed = isPullArmed(progress.current);
    const nowArmed = isPullArmed(next);
    progress.current = next;
    nodeRef.current?.style.setProperty("--jtb-pull", next.toFixed(3));

    // The one moment a delegated press listener cannot see: the pull just
    // became a decision. Fired on the CROSSING only -- a buzz on every frame
    // above the line would be a rumble, and a rumble says nothing.
    if (nowArmed && !wasArmed) pulse("stamp");

    // React bails out on an unchanged value, so this costs a render only on
    // the two frames where the button crosses the threshold.
    setArmed(nowArmed);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    startY.current = event.clientY;
    consumed.current = false;
    event.currentTarget.dataset.dragging = "true";
    // Capture, or the drag dies the moment the finger leaves a 40px circle.
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    if (startY.current === null) return;
    applyProgress(pullProgress(startY.current - event.clientY));
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLAnchorElement>) {
    if (startY.current === null) return;
    const leaving = isPullArmed(progress.current);

    startY.current = null;
    event.currentTarget.dataset.dragging = "false";
    // Reset first: on the way out this leaves nothing half-red behind for the
    // back button to come home to.
    applyProgress(0);

    if (leaving) {
      // A pull that ends off the button never produces a click, so the
      // navigation has to happen here; the flag stops the click that DOES
      // follow a pull ending on it from repeating the trip.
      consumed.current = true;
      router.push(EXIT_HREF);
    }
  }

  return (
    <>
      <Link
        ref={nodeRef}
        href={EXIT_HREF}
        draggable={false}
        data-testid="jarvis-exit"
        aria-label={t("jarvis.close")}
        aria-describedby="jarvis-exit-hint"
        className={cn(ROUND_BUTTON_CLASS, "jtb-exit")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={(event) => {
          // The ordinary link does the ordinary thing. The one exception is
          // the click that trails a completed pull, which has already left.
          if (consumed.current) {
            consumed.current = false;
            event.preventDefault();
          }
        }}
      >
        {armed ? (
          <X className="size-4.5 text-primary-foreground" aria-hidden="true" />
        ) : (
          <ChevronUp className="size-4.5" aria-hidden="true" />
        )}
      </Link>
      {/* The instruction, and then the one thing that changes about it. Kept
          outside the link so it never becomes part of its accessible name. */}
      <span id="jarvis-exit-hint" className="sr-only" aria-live="polite">
        {armed ? t("jarvis.exit.armed") : t("jarvis.exit.hint")}
      </span>
    </>
  );
}
