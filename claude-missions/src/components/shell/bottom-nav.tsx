"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChartColumnBig, Home, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * F005: bottom navigation. Four Serbian tabs; plain `next/link` anchors are
 * natively keyboard-reachable (Tab / Shift+Tab, activate with Enter).
 *
 * Rendered as a floating dark frosted-glass pill (see `AppNavBar`), always
 * visible over scrolling content. `liquid-glass` adds the top-edge gloss;
 * `backdrop-blur` + the translucent card tint make it read as frosted glass
 * on the dark theme.
 */
const NAV_ITEMS = [
  { href: "/danas", label: "Početna", icon: Home },
  { href: "/analitika", label: "Analitika", icon: ChartColumnBig },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/profil", label: "Podešavanja", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Glavna navigacija"
      className="liquid-glass pointer-events-auto flex flex-1 items-stretch justify-around gap-0.5 rounded-full border border-border bg-card/80 px-1.5 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || Boolean(pathname?.startsWith(`${href}/`));

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1 text-[11px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "text-primary"
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
