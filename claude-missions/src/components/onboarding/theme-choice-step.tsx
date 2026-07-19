"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { applyTheme, type Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

/**
 * First thing after sign-up (between the welcome screen and the questionnaire):
 * pick a light or dark look. Tapping a card applies the theme LIVE (the whole
 * screen switches immediately) and writes the cookie, so the choice is already
 * in effect by the time they continue. Defaults to dark (the app's default).
 * Changeable any time from Settings.
 */
export function ThemeChoiceStep({ onContinue }: { onContinue: () => void }) {
  const [theme, setTheme] = useState<Theme>("dark");

  function pick(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-12">
      <div className="flex flex-1 flex-col justify-center gap-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Izaberi izgled
          </h1>
          <p className="text-sm text-muted-foreground">
            Možeš ga promeniti bilo kad u podešavanjima.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ThemeCard
            label="Svetla"
            icon={Sun}
            theme="light"
            selected={theme === "light"}
            onSelect={pick}
          />
          <ThemeCard
            label="Tamna"
            icon={Moon}
            theme="dark"
            selected={theme === "dark"}
            onSelect={pick}
          />
        </div>
      </div>

      <Button onClick={onContinue} className="h-12 w-full text-base">
        Nastavi
      </Button>
    </div>
  );
}

function ThemeCard({
  label,
  icon: Icon,
  theme,
  selected,
  onSelect,
}: {
  label: string;
  icon: typeof Sun;
  theme: Theme;
  selected: boolean;
  onSelect: (theme: Theme) => void;
}) {
  const isLight = theme === "light";
  // The mini-preview swatches are hard-coded to each theme's real colours so
  // BOTH options stay visible regardless of which theme is currently active.
  const surface = isLight ? "#ffffff" : "#0a0c0b";
  const accent = isLight ? "#0a0c0b" : "#17d1a8";
  const line = isLight ? "#e5e7e9" : "#191e20";
  const swatchBorder = isLight ? "#e5e7e9" : "rgba(255,255,255,0.1)";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(theme)}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-colors",
        selected ? "border-primary" : "border-border"
      )}
    >
      <div
        className="w-full rounded-xl border p-3"
        style={{ backgroundColor: surface, borderColor: swatchBorder }}
      >
        <div
          className="h-2.5 w-10 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <div
          className="mt-2 h-1.5 w-full rounded-full"
          style={{ backgroundColor: line }}
        />
        <div
          className="mt-1.5 h-1.5 w-2/3 rounded-full"
          style={{ backgroundColor: line }}
        />
      </div>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </span>
    </button>
  );
}
