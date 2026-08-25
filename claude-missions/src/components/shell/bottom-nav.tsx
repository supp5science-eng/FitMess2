"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChartColumnBig, Home, Settings } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * F005: bottom navigation. Three Serbian tabs; plain `next/link` anchors are
 * natively keyboard-reachable (Tab / Shift+Tab, activate with Enter).
 *
 * Rendered as a floating paper pill inside an ink hairline (see `AppNavBar`),
 * always visible over scrolling content. `liquid-glass` lays the halftone
 * overprint on the pill itself; on top of that a single **sliding lens** (the
 * `.nav-glass` element) travels from tab to tab as you switch sections — one
 * pressed cartouche that moves, rather than an icon that merely recolours.
 *
 * Positioning is measured (not percentage-guessed) so the lens sits exactly
 * over the active tab regardless of the pill's padding/gaps, and re-measures
 * on resize. The slide transition is enabled only AFTER the first measured
 * position (`ready`) so the lens never slides in from the left on load, and
 * it collapses to a plain fade under `prefers-reduced-motion`.
 */
const NAV_ITEMS: {
  href: string;
  labelKey: MessageKey;
  icon: typeof Home;
}[] = [
  { href: "/danas", labelKey: "nav.home", icon: Home },
  { href: "/analitika", labelKey: "nav.analytics", icon: ChartColumnBig },
  { href: "/profil", labelKey: "nav.profile", icon: Settings },
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

interface IndicatorRect {
  x: number;
  width: number;
  visible: boolean;
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicator, setIndicator] = useState<IndicatorRect>({
    x: 0,
    width: 0,
    visible: false,
  });
  const [ready, setReady] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  const activeIndex = NAV_ITEMS.findIndex(
    ({ href }) => pathname === href || Boolean(pathname?.startsWith(`${href}/`))
  );

  // Measure the active tab's box relative to the nav and park the lens over
  // it. Runs on active-tab change and on resize. When no tab matches (e.g. on
  // an `/dodaj/*` route), the lens fades out rather than sitting on a wrong tab.
  useLayoutEffect(() => {
    function measure() {
      const nav = navRef.current;
      const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
      if (!nav || !el) {
        setIndicator((prev) => ({ ...prev, visible: false }));
        return;
      }
      const navRect = nav.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({
        x: elRect.left - navRect.left,
        width: elRect.width,
        visible: true,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex]);

  // Enable the slide transition only after the first position is committed, so
  // the lens appears in place on load instead of sliding in from x=0.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const slide = ready && !reduceMotion;

  return (
    <nav
      ref={navRef}
      aria-label="Glavna navigacija"
      className="liquid-glass pointer-events-auto relative flex flex-1 items-stretch justify-around gap-0.5 rounded-full border border-ink/45 bg-card/85 px-1.5 py-2 shadow-[0_3px_0_-1px_color-mix(in_srgb,var(--ink)_25%,transparent)] backdrop-blur-xl"
    >
      {/* Sliding liquid-glass lens behind the active tab (decorative). */}
      <span
        aria-hidden="true"
        data-testid="nav-glass-indicator"
        className="nav-glass pointer-events-none absolute left-0 top-1 bottom-1"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.x}px)`,
          opacity: indicator.visible ? 1 : 0,
          transition: slide
            ? "transform 440ms cubic-bezier(0.34, 1.4, 0.5, 1), width 440ms cubic-bezier(0.34, 1.4, 0.5, 1), opacity 200ms ease"
            : "opacity 200ms ease",
        }}
      />

      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }, index) => {
        const isActive = index === activeIndex;

        return (
          <Link
            key={href}
            href={href}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative z-10 flex min-w-0 flex-1 flex-col items-center gap-1 rounded-full px-0.5 py-1 font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {/* Short labels (longest is "Analitika") at 10px + tight tracking
                stay well inside the rounded glass lens, including near its
                curved lower edge, down to 375px. */}
            <span className="max-w-full whitespace-nowrap text-[10px] leading-none tracking-tight">
              {t(labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
