"use client";

import React, { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { applyTheme, type Theme } from "@/lib/theme/theme";
import "./name-screen.css";
import "./theme-choice-screen.css";

/**
 * The theme-choice moment — shown right after the name screen ("Kako da te
 * zovemo?") and before the plan reveal. Same choreography as the name screen
 * (`.ns` glow + word-by-word title bloom + exhale outro), so it reads as one
 * continuous breath: the user types their name, then picks how the app should
 * look, then their plan appears.
 *
 * LIGHT IS THE DEFAULT: we `applyTheme("light")` on mount, so the stage itself
 * shows the default look and "Svetla" starts selected. Tapping either card
 * live-previews that theme across the whole screen (the `.ns` stage is
 * token-driven); the small preview windows inside the cards keep explicit
 * colors so each always shows its own theme. `applyTheme` persists the choice
 * to the per-device `fm_theme` cookie, so the rest of the app (and the next
 * server render) agree. Purely presentational + local state: the chosen theme
 * is handed up via `onSubmit` after the outro plays.
 */

const OUTRO_MS = 600; // keep in sync with `ns-out` in name-screen.css

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden>
      <path
        d="M5 12.5l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.2A8 8 0 0 1 9.8 4 8 8 0 1 0 20 14.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.4" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="1.6"
          x2="12"
          y2="4.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function ThemeChoiceScreen({
  onSubmit,
}: {
  onSubmit: (theme: Theme) => void;
}) {
  const { t } = useT();
  const TITLE_WORDS = t("onboarding.theme.title").split(" ");
  const [selected, setSelected] = useState<Theme>("light");
  const [leaving, setLeaving] = useState(false);
  const submittedRef = useRef(false);

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Light by default: apply on mount so the stage shows the default look and the
  // "Svetla" card starts genuinely active (not just visually pre-selected).
  useEffect(() => {
    applyTheme("light");
  }, []);

  function choose(next: Theme) {
    setSelected(next);
    applyTheme(next); // live preview + persist
  }

  function handleContinue() {
    if (leaving || submittedRef.current) return;
    applyTheme(selected); // belt-and-braces: persist the final choice
    submittedRef.current = true;
    if (reduced) {
      onSubmit(selected);
      return;
    }
    setLeaving(true);
    setTimeout(() => onSubmit(selected), OUTRO_MS);
  }

  const cards: {
    value: Theme;
    label: string;
    icon: React.ReactNode;
    previewClass: string;
  }[] = [
    {
      value: "light",
      label: t("theme.light"),
      icon: <SunIcon />,
      previewClass: "tc-preview-light",
    },
    {
      value: "dark",
      label: t("theme.dark"),
      icon: <MoonIcon />,
      previewClass: "tc-preview-dark",
    },
  ];

  return (
    <main className={`ns${leaving ? " ns-leaving" : ""}`}>
      <div className="ns-stage">
        <span className="ns-kicker">{t("onboarding.theme.kicker")}</span>
        <h1 className="ns-title">
          {TITLE_WORDS.map((word, i) => (
            <React.Fragment key={word}>
              {i > 0 ? " " : null}
              <span
                className="ns-word"
                style={{ "--ns-word-i": i } as React.CSSProperties}
              >
                {word}
              </span>
            </React.Fragment>
          ))}
        </h1>
        <p className="ns-hint" style={{ animationDelay: "0.75s" }}>
          {t("onboarding.theme.hint")}
        </p>

        <div
          className="tc-options"
          role="radiogroup"
          aria-label={t("onboarding.theme.groupAria")}
        >
          {cards.map((card) => {
            const active = selected === card.value;
            return (
              <button
                key={card.value}
                type="button"
                role="radio"
                // `aria-checked` only -- `aria-pressed` is the toggle-BUTTON
                // state and is not valid on a radio; a screen reader given both
                // is being told the same thing in two vocabularies.
                aria-checked={active}
                aria-label={card.label}
                onClick={() => choose(card.value)}
                className="tc-card"
              >
                <span className="tc-check" aria-hidden>
                  <CheckIcon />
                </span>
                <span className={`tc-preview ${card.previewClass}`} aria-hidden>
                  <span className="tc-dot" />
                  <span className="tc-bar tc-bar-wide" />
                  <span className="tc-bar tc-bar-mid" />
                </span>
                <span className="tc-label">
                  {card.icon}
                  {card.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="tc-cta">
          <Button
            type="button"
            onClick={handleContinue}
            disabled={leaving}
            className="h-14 w-full rounded-full text-base font-semibold"
          >
            {t("onboarding.continue")}
          </Button>
        </div>
      </div>
    </main>
  );
}
