"use client";

import { useEffect, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";

import "./ai-thinking.css";

/**
 * The shared "AI razmišlja" loading animation — used everywhere the app is
 * waiting on a Gemini estimate (Prizma, Slikaj obrok, Reci obrok, Deklaracija).
 * A morphing brand-gradient orb inside two counter-turning comet arcs, over a
 * faint rail, with a short status line that cycles through `lines` so the wait
 * feels alive and on-brand instead of a bare spinner. See `ai-thinking.css`.
 */

export function AiThinking({
  title,
  lines,
  className = "",
}: {
  title?: string;
  lines?: string[];
  className?: string;
}) {
  const { t } = useT();
  const resolvedTitle = title ?? t("media.aiThinking.title");
  const resolvedLines = lines ?? [
    t("media.aiThinking.line1"),
    t("media.aiThinking.line2"),
    t("media.aiThinking.line3"),
    t("media.aiThinking.line4"),
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (resolvedLines.length <= 1) return;
    const id = setInterval(
      () => setI((n) => (n + 1) % resolvedLines.length),
      1400
    );
    return () => clearInterval(id);
  }, [resolvedLines.length]);

  const line = resolvedLines[Math.min(i, resolvedLines.length - 1)] ?? "";

  return (
    <div className={`ai-think ${className}`.trim()} role="status" aria-live="polite">
      <div className="ai-think-orb" aria-hidden="true">
        {/* The rail the arcs travel on — without it a lone arc reads as a
            broken circle rather than as something in motion. */}
        <span className="ai-think-track" />
        <span className="ai-think-arc ai-think-arc-outer" />
        <span className="ai-think-arc ai-think-arc-inner" />
        <span className="ai-think-halo" />
        <span className="ai-think-halo" />
        <span className="ai-think-core" />
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-base font-semibold text-foreground">
          {resolvedTitle}
        </p>
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
