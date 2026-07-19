"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { applyTheme, type Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

/**
 * A "Svetla | Tamna" segmented control for Settings. Applies the theme live
 * (swaps the <html> class + writes the cookie via `applyTheme`) on tap, then
 * `router.refresh()` so the server-rendered bits (theme class, PWA
 * theme-color) agree on the next render. `initialTheme` comes from the
 * server (the resolved `fm_theme` cookie) so there's no hydration mismatch.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function select(next: Theme) {
    if (next === theme) return;
    setTheme(next);
    applyTheme(next);
    router.refresh();
  }

  const options: { value: Theme; label: string }[] = [
    { value: "light", label: "Svetla" },
    { value: "dark", label: "Tamna" },
  ];

  return (
    <div
      role="group"
      aria-label="Izgled aplikacije"
      className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
    >
      {options.map(({ value, label }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => select(value)}
            className={cn(
              "min-h-9 rounded-full px-5 text-sm font-semibold transition-colors",
              selected
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
