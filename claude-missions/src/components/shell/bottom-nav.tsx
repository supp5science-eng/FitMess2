"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, ChartColumnBig, Home, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * F005: bottom navigation. Four Serbian tabs; plain `next/link` anchors are
 * natively keyboard-reachable (Tab / Shift+Tab, activate with Enter).
 *
 * Rendered as a floating dark frosted-glass pill (see `AppNavBar`), always
 * visible over scrolling content. `liquid-glass` adds the top-edge gloss on
 * the pill itself; on top of that a single **sliding "liquid glass" lens**
 * (the `.nav-glass` element) morphs from tab to tab as you switch sections —
 * the Apple "Liquid Glass" feel from the reference: one frosted bubble that
 * animates to the active tab instead of just recolouring an icon.
 *
 * Positioning is measured (not percentage-guessed) so the lens sits exactly
 * over the active tab regardless of the pill's padding/gaps, and re-measures
 * on resize. The slide transition is enabled only AFTER the first measured
 * position (`ready`) so the lens never slides in from the left on load, and
 * it collapses to a plain fade under `prefers-reduced-motion`.
 */
const NAV_ITEMS = [
  { href: "/danas", label: "Početna", icon: Home },
  { href: "/analitika", label: "Analitika", icon: ChartColumnBig },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/profil", label: "Podešavanja", icon: Settings },
] as const;

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
      className="liquid-glass pointer-events-auto relative flex flex-1 items-stretch justify-around gap-0.5 rounded-full border border-border bg-card/80 px-1.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
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

      {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
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
              "relative z-10 flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
