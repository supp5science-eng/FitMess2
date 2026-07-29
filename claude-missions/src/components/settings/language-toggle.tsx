"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { applyLocale, type Locale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

/**
 * A "Srpski | English" segmented control for Settings. Applies the language
 * live (sets `<html lang>` + writes the `fm_locale` cookie via `applyLocale`)
 * on tap, then `router.refresh()` so the server-rendered copy re-renders in the
 * new language. `initialLocale` comes from the server (the resolved cookie), so
 * there is no hydration mismatch.
 *
 * The option labels are endonyms (each language in its own name), so they read
 * the same regardless of the current language.
 */
export function LanguageToggle({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(initialLocale);

  function select(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    applyLocale(next);
    router.refresh();
  }

  const options: { value: Locale; label: string }[] = [
    { value: "sr", label: "Srpski" },
    { value: "en", label: "English" },
  ];

  return (
    <div
      role="group"
      aria-label="Language / Jezik"
      className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
    >
      {options.map(({ value, label }) => {
        const selected = locale === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => select(value)}
            className={cn(
              "min-h-9 rounded-full px-4 text-sm font-semibold transition-colors",
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
