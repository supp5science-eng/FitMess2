"use client";

import React, { useEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/onboarding/field-error";
import { MAX_NAME_LENGTH, validateName } from "@/lib/onboarding/validation";
import "./name-screen.css";

/**
 * The post-registration "Kako da te zovemo?" moment. The questionnaire itself
 * is anonymous (the `ime` step was removed from the wizard) — the FIRST thing
 * a freshly-registered user sees while the app loads is this screen: the
 * question blooms in word by word, they type their name into a big quiet
 * input, and on submit the stage exhales straight into the plan reveal, which
 * greets them by that name ("Zdravo, <ime>!"). See `name-screen.css` for the
 * choreography; all motion collapses under `prefers-reduced-motion`.
 *
 * Purely presentational + local state: hands the trimmed name up via
 * `onSubmit` after the outro plays. The parent (`onboarding-flow.tsx`) merges
 * it into the collected answers and persists everything in one write.
 */

const OUTRO_MS = 600; // keep in sync with `ns-out` in name-screen.css

export function NameScreen({ onSubmit }: { onSubmit: (name: string) => void }) {
  const { t } = useT();
  const TITLE_WORDS = t("onboarding.name.title").split(" ");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Invite the caret in once the question has settled (immediately under
  // reduced motion). Programmatic focus never force-opens the mobile
  // keyboard mid-animation, so this stays smooth either way.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 1300);
    return () => clearTimeout(id);
  }, [reduced]);

  const hasName = value.trim() !== "";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (leaving) return;
    const result = validateName(value);
    if (!result.valid) {
      setError(result.error);
      return;
    }
    const name = value.trim();
    if (reduced) {
      onSubmit(name);
      return;
    }
    setLeaving(true);
    setTimeout(() => onSubmit(name), OUTRO_MS);
  }

  return (
    <main className={`ns${leaving ? " ns-leaving" : ""}`}>
      <form className="ns-stage" onSubmit={handleSubmit} noValidate>
        <span className="ns-kicker">{t("onboarding.name.kicker")}</span>
        {/* The words animate as inline-blocks, so the separating spaces MUST
            be their own text nodes between the spans — whitespace inside an
            inline-block collapses away (visually and in the accessible
            name). */}
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

        <div className="ns-field">
          <label htmlFor="ime" className="sr-only">
            {t("onboarding.name.label")}
          </label>
          <input
            ref={inputRef}
            id="ime"
            name="ime"
            type="text"
            className="ns-input"
            placeholder={t("onboarding.name.placeholder")}
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            value={value}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "ime-error" : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
          />
          <FieldError message={error} id="ime-error" />
          <p className="ns-hint">{t("onboarding.name.hint")}</p>
        </div>

        <div className={`ns-cta${hasName ? " ns-cta-show" : ""}`}>
          <Button
            type="submit"
            disabled={leaving}
            className="h-14 w-full rounded-full text-base font-semibold"
          >
            {t("onboarding.continue")}
          </Button>
        </div>
      </form>
    </main>
  );
}
