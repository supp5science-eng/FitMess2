"use client";

import { useEffect, useState } from "react";

import "./ai-thinking.css";

/**
 * The shared "AI razmišlja" loading animation — used everywhere the app is
 * waiting on a Gemini estimate (Prizma, Slikaj obrok, Reci obrok, Deklaracija).
 * A morphing brand-gradient orb under a rotating ring + pulsing haloes, with a
 * short status line that cycles through `lines` so the wait feels alive and
 * on-brand instead of a bare spinner. See `ai-thinking.css` for the motion.
 */

const DEFAULT_LINES = [
  "Analiziram slike…",
  "Prepoznajem sastojke…",
  "Računam makronutrijente…",
  "Skoro gotovo…",
];

export function AiThinking({
  title = "Procenjujem…",
  lines = DEFAULT_LINES,
  className = "",
}: {
  title?: string;
  lines?: string[];
  className?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const id = setInterval(
      () => setI((n) => (n + 1) % lines.length),
      1400
    );
    return () => clearInterval(id);
  }, [lines.length]);

  const line = lines[Math.min(i, lines.length - 1)] ?? "";

  return (
    <div className={`ai-think ${className}`.trim()} role="status" aria-live="polite">
      <div className="ai-think-orb" aria-hidden="true">
        <span className="ai-think-ring" />
        <span className="ai-think-ring" />
        <span className="ai-think-ring" />
        <span className="ai-think-core" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {/* `key` remounts the node so the fade re-plays on every change. */}
        <p key={i} className="ai-think-line text-sm text-muted-foreground">
          {line}
        </p>
      </div>

      <div className="ai-think-bar" aria-hidden="true">
        <i />
      </div>
    </div>
  );
}
