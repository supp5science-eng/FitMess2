"use client";

import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";

import { AiOrbCanvas, type AiOrbMode } from "@/components/ai/ai-orb-canvas";
import { prizmaProse, prizmaVoice } from "@/components/ai/prizma-font";
import { useT } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import "./prizma-voice-mode.css";

/**
 * JARVIS — Prizma with the keyboard taken away (2026-08-26 redesign).
 *
 * The owner's brief was one sentence: "levo bude jarvis gde će biti samo
 * audio deo". So this screen has exactly three things on it — the orb, ONE
 * line saying what is happening, and one big circle you press. No thread, no
 * chips, no action cards. Its whole job is to be quieter than the chat mode
 * standing next to it; anything added here is something the eye has to step
 * over on the way to the button.
 *
 * It owns no logic. Recording, transcription, sending and TTS all live in
 * `agent-screen.tsx` and arrive here as props — this file is the face, not
 * the machine. In particular there is no recording state of its own: a second
 * source of truth for "am I listening" is exactly how the mic ends up stuck
 * open on one of the two screens.
 *
 * The one thing it does own is the ring around the button, and the reason it
 * owns it is performance: the mic level is a 60 Hz signal, and pushing that
 * through `useState` would re-render the tree (orb included) sixty times a
 * second. Instead the rAF loop writes a CSS variable straight onto the button
 * node and CSS does the rest — React never learns the level changed.
 */

/** The state line and the orb both read from this — one derivation, so the
 *  words under the orb can never disagree with the face above them. */
type VoicePhase =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking";

const PHASE_LINE: Record<VoicePhase, MessageKey> = {
  idle: "prizma.voice.idle",
  listening: "prizma.voice.listening",
  transcribing: "prizma.voice.transcribing",
  thinking: "prizma.voice.thinking",
  speaking: "prizma.voice.speaking",
};

/** Only the two states the user can act on carry a second line. The three
 *  "wait a moment" states say nothing extra — waiting needs no instructions. */
const PHASE_HINT: Partial<Record<VoicePhase, MessageKey>> = {
  idle: "prizma.voice.idleHint",
  listening: "prizma.voice.listeningHint",
};

export function PrizmaVoiceMode({
  orbMode,
  getLevel,
  voiceState,
  isSending,
  isSpeaking,
  lastReply,
  onMicTap,
  onInterrupt,
  error,
  className,
}: {
  orbMode: AiOrbMode;
  getLevel: () => number;
  voiceState: "idle" | "listening" | "transcribing";
  isSending: boolean;
  isSpeaking: boolean;
  /** Poslednji Prizmin odgovor, ako ga ima — da se može i pročitati, ne samo čuti. */
  lastReply: string | null;
  /** Tap na veliki taster: počni slušanje, ili završi i pošalji. */
  onMicTap: () => void;
  /** Tap dok Prizma govori — prekini je. */
  onInterrupt: () => void;
  error: string | null;
  className?: string;
}): React.JSX.Element {
  const { t } = useT();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // What the user is doing outranks what Prizma is doing: if the ear is open
  // we say "slušam" even while the previous answer is still finishing.
  const phase: VoicePhase =
    voiceState === "listening"
      ? "listening"
      : voiceState === "transcribing"
        ? "transcribing"
        : isSpeaking
          ? "speaking"
          : isSending
            ? "thinking"
            : "idle";

  const isListening = phase === "listening";
  const isBusy = phase === "transcribing" || phase === "thinking";

  /**
   * The live ring. `getLevel()` is read every frame and written to
   * `--pvm-level` on the button node — a ref, not state, so this costs one
   * style write per frame instead of a React render.
   *
   * Two details that are not decoration:
   * - the value is smoothed with an asymmetric follow (fast attack, slow
   *   release), because the raw RMS off the mic flickers between syllables
   *   and an unsmoothed ring reads as a fault rather than as a voice;
   * - `getLevel` may report -1 ("no tap available"), which must clamp to 0
   *   rather than shrink the ring inside the button.
   */
  useEffect(() => {
    const node = buttonRef.current;
    if (!node || !isListening) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Reduced motion gets the fixed ring from the stylesheet; no loop runs,
      // which is also the cheapest thing we can do on that user's battery.
      return;
    }

    let frame = 0;
    let smoothed = 0;
    const tick = () => {
      const raw = getLevel();
      const level = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
      smoothed += (level - smoothed) * (level > smoothed ? 0.45 : 0.12);
      node.style.setProperty("--pvm-level", smoothed.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--pvm-level", "0");
    };
  }, [getLevel, isListening]);

  const line = t(PHASE_LINE[phase]);
  const hintKey = PHASE_HINT[phase];

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-between px-8 pt-6 pb-8",
        className
      )}
      data-testid="prizma-voice-mode"
      data-phase={phase}
    >
      {/* The orb sits in the middle of an empty screen and carries the whole
          state on its own; the text below it is a caption, not a headline. */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
        <AiOrbCanvas className="size-56" mode={orbMode} getLevel={getLevel} />

        <div
          className="flex flex-col items-center gap-2 text-center"
          role="status"
          aria-live="polite"
        >
          {/* `key` remounts the node so the cross-fade re-plays on every
              change — the same pattern `AiThinking` uses. */}
          <p
            key={phase}
            className={cn(
              prizmaVoice.className,
              "pvm-line text-xl leading-tight font-semibold text-foreground"
            )}
          >
            {line}
          </p>
          {hintKey ? (
            <p
              key={`${phase}-hint`}
              className={cn(
                prizmaVoice.className,
                "pvm-hint max-w-[28ch] text-[13px] leading-relaxed text-muted-foreground"
              )}
            >
              {t(hintKey)}
            </p>
          ) : null}
        </div>

        {/* The answer was spoken; this is the copy for the ear that missed a
            word. Small, clamped, and never the thing you look at first. */}
        {lastReply ? (
          <p
            key={lastReply}
            className={cn(
              prizmaProse.className,
              "pvm-reply line-clamp-3 max-w-[34ch] text-center text-[13px] leading-relaxed text-muted-foreground"
            )}
          >
            {lastReply}
          </p>
        ) : null}

        {error ? (
          <p
            className="max-w-[34ch] text-center text-sm text-destructive"
            data-testid="agent-error"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={isSpeaking ? onInterrupt : onMicTap}
        // Interrupting has to stay live while she talks; only the two states
        // where a tap has nothing to do are blocked.
        disabled={isBusy}
        aria-label={t(
          isSpeaking
            ? "prizma.voice.interrupt"
            : isListening
              ? "prizma.voice.stop"
              : "prizma.voice.start"
        )}
        data-testid="prizma-voice-button"
        data-live={isListening ? "true" : "false"}
        data-idle={phase === "idle" ? "true" : "false"}
        className={cn(
          "pvm-button relative flex size-20 shrink-0 items-center justify-center rounded-full",
          "liquid-glass bg-primary text-primary-foreground fm-lift",
          "active:scale-95",
          "focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none",
          "disabled:opacity-50"
        )}
      >
        <span className="pvm-halo" aria-hidden="true" />
        <span className="pvm-halo pvm-halo-wide" aria-hidden="true" />
        {/* A filled stop square whenever a tap ENDS something — the open ear
            or her sentence. The mic only shows when a tap would start one. */}
        {isListening || isSpeaking ? (
          <Square className="size-6 fill-current" aria-hidden="true" />
        ) : (
          <Mic className="size-7" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
