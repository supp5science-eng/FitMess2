"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CalendarDays, Home, User } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * F005: bottom navigation skeleton. Four Serbian tabs; routes may 404 for
 * now (later features fill /danas, /nedelja, /agent, /profil). Plain
 * `next/link` anchors are natively keyboard-reachable (Tab / Shift+Tab,
 * activate with Enter) with no extra wiring required.
 */
const NAV_ITEMS = [
  { href: "/danas", label: "Danas", icon: Home },
  { href: "/nedelja", label: "Nedelja", icon: CalendarDays },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/profil", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Glavna navigacija"
      // iOS standalone PWA: pad past the home indicator so the tabs stay tappable.
      className="sticky bottom-0 z-10 flex w-full items-stretch justify-around border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
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
              "flex flex-1 flex-col items-center gap-1 rounded-md px-2 py-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
