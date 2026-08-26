"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AudioLines, MessageSquare, Settings, X } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Prizma's top bar — the chrome above the `/ai` screen (2026-08-26 redesign).
 *
 * Three pieces, the Perplexity mobile layout: a round button out to profile &
 * settings, the two-mode segmented control in the middle, and a round button
 * back out to the app. That right-hand exit is NOT decoration: the bottom
 * navigation is hidden on this screen, so in an installed PWA (no browser
 * chrome, no back button) it is the only way out of Prizma.
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

export type PrizmaMode = "voice" | "chat";

const MODES: {
  mode: PrizmaMode;
  labelKey: MessageKey;
  Icon: typeof AudioLines;
}[] = [
  { mode: "voice", labelKey: "prizma.mode.voice", Icon: AudioLines },
  { mode: "chat", labelKey: "prizma.mode.chat", Icon: MessageSquare },
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

/** Shared shape of the two round chrome buttons flanking the segments. */
const ROUND_BUTTON_CLASS = cn(
  "flex size-10 shrink-0 items-center justify-center rounded-full",
  "border border-border bg-card text-foreground fm-lift transition-colors",
  "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
);

export function PrizmaTopBar({
  mode,
  onModeChange,
  className,
}: {
  mode: PrizmaMode;
  onModeChange: (mode: PrizmaMode) => void;
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
    MODES.findIndex((item) => item.mode === mode)
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
      data-testid="prizma-top-bar"
      className={cn("flex h-10 items-center gap-2", className)}
    >
      <Link
        href="/profil"
        aria-label={t("prizma.settings")}
        className={ROUND_BUTTON_CLASS}
      >
        <Settings className="size-4.5" aria-hidden="true" />
      </Link>

      <div
        ref={listRef}
        role="tablist"
        aria-label={t("prizma.mode.switch")}
        className="relative flex h-10 min-w-0 flex-1 items-stretch rounded-full bg-muted p-1"
      >
        {/* The sliding pill behind the active segment (decorative). */}
        <span
          aria-hidden="true"
          data-testid="prizma-mode-indicator"
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
              data-testid={`prizma-mode-${itemMode}`}
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
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>

      <Link
        href="/danas"
        aria-label={t("prizma.close")}
        className={ROUND_BUTTON_CLASS}
      >
        <X className="size-4.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
