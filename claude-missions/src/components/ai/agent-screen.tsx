"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Camera,
  ChartColumnBig,
  Dumbbell,
  FileText,
  Home,
  Mic,
  Scale,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";

import { transcribeVoiceAction } from "@/app/(app)/ai/actions";
import { AiOrbCanvas, type AiOrbMode } from "@/components/ai/ai-orb-canvas";
import { JarvisComposer } from "@/components/ai/jarvis-composer";
import { JarvisExitRail } from "@/components/ai/jarvis-exit-rail";
import { jarvisProse, jarvisVoice } from "@/components/ai/jarvis-font";
import {
  JarvisTopBar,
  type JarvisMode,
} from "@/components/ai/jarvis-top-bar";
import { JarvisVoiceMode } from "@/components/ai/jarvis-voice-mode";
import type { AgentActionId } from "@/lib/ai/agent-actions";
import { useT } from "@/components/i18n/locale-provider";
import { playTtsBlob, type TtsPlayback } from "@/lib/audio/play-tts";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { createSpeaker, type Speaker } from "@/lib/audio/speak";
import type { MessageKey } from "@/lib/i18n/messages";
import { useKeyboardInset } from "@/lib/ui/use-keyboard-inset";
import { cn } from "@/lib/utils";

/**
 * Jarvis — the whole AI tab (Jarvis v1, 2026-08-25, per the design canvas).
 *
 * The grammar, in one breath: the ORB is the center of the world while
 * Jarvis waits (big, with a personal greeting built from live data); once a
 * conversation runs it shrinks to a 32px status light at the top and the
 * exchange takes the screen — the user's line in a quiet tinted bubble, its
 * answer as plain prose, and under it the ACTION ROWS it brings when the
 * message asked for a deed ("hoću da logujem obrok" → Prizma unos / Slikaj /
 * Gric). Tapping a row opens the existing flow; Jarvis never explains where
 * to tap.
 *
 * THE EXCHANGE (2026-08-26). The first cut of this screen set its answers at
 * 19px, hung the user's line in the air as a right-aligned quote, and gave
 * every brought flow a bordered, lifted, accent-filled card with a 44px icon
 * tile. On a 390px phone that reads as loud and unsorted: heading-sized prose
 * eats the viewport, a right-aligned quote with no body starts each line in a
 * different place, and three checkout-weight cards bury the answer they
 * belong to. What fixed it was not restyling any one of those but giving the
 * screen a rhythm — see `PRIZMA_TURN_GAP`. Her prose sits at 16px/1.62 (a
 * paragraph, not a title), the user's line gets a body so it stops floating,
 * and the flows became hairline rows.
 *
 * Actions arrive from `/api/ai/agent` as catalog ids; all copy and icons
 * resolve client-side from i18n + the icon map below, so the model cannot
 * write a button. The thread lives in `sessionStorage` (fresh tomorrow);
 * mutating actions with confirmation (v2) are deliberately not here yet.
 *
 * VOICE (Faza C, 2026-08-26): the mic button records (mono 16 kHz WAV, same
 * recorder as Gric), Gemini writes the sentence down (`transcribeVoiceAction`)
 * and the transcript enters the SAME `send` path as typing — one
 * conversation, whichever mouth it came from. A spoken turn is answered
 * aloud through the system TTS (`speak.ts`; silent when the device has no
 * ex-Yu voice). The orb is the face of all of it: it pulses on the user's
 * live mic level while LISTENING, tightens while THINKING, and ripples on a
 * speech envelope while SPEAKING — see `ai-orb-canvas.tsx`.
 */

interface AgentAction {
  id: AgentActionId;
  href: string;
}

interface AgentMessage {
  role: "user" | "model";
  text: string;
  actions?: AgentAction[];
}

const STORAGE_KEY = "fm_agent_chat_v2";
/** How many trailing turns each request carries (the server recomputes facts
 * anyway, the model only needs recent thread). Actions are client-side only
 * and are stripped before sending. */
const SENT_TURNS = 12;

/** The gap that opens BEFORE a new question. Everything inside one turn sits
 * at `mb-3.5` (14px); this is 26px, so the eye groups a question with its
 * answer instead of reading the thread as evenly spaced rubble. */
const PRIZMA_TURN_GAP = "mt-[26px]";

const ACTION_ICONS: Record<AgentActionId, LucideIcon> = {
  prizma_unos: Target,
  slikaj_obrok: Camera,
  gric: Mic,
  deklaracija: FileText,
  trening: Dumbbell,
  danas: Home,
  analitika: ChartColumnBig,
  merenje: Scale,
  podesavanja: Settings,
};

function readStoredMessages(): AgentMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is AgentMessage =>
        typeof m === "object" &&
        m !== null &&
        ((m as AgentMessage).role === "user" ||
          (m as AgentMessage).role === "model") &&
        typeof (m as AgentMessage).text === "string"
    );
  } catch {
    return [];
  }
}

function storeMessages(messages: AgentMessage[]): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full/blocked -> the thread simply won't survive a reload.
  }
}

export function AgentScreen({
  greeting,
  contextLine,
  ttsAvailable = false,
}: {
  /** "Dobro jutro, Marko." — composed server-side from the profile. */
  greeting: string;
  /** "Do sada 1.250 kcal — ostalo ti je 650." or null when unknown. */
  contextLine: string | null;
  /** Whether the server has an ElevenLabs key — spoken replies then go
   * through `/api/ai/agent/tts` first, system TTS stays the fallback. */
  ttsAvailable?: boolean;
}) {
  const { t } = useT();
  const [messages, setMessages] = useState<AgentMessage[]>(readStoredMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Voice: "listening" while the mic runs, "transcribing" between stop and
  // the transcript coming back; the agent turn itself is `isSending`.
  const [voiceState, setVoiceState] = useState<
    "idle" | "listening" | "transcribing"
  >("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  /** Which half of the screen is showing. Chat is the default on purpose:
   * it is what this tab has always opened as, it needs no microphone
   * permission to be useful, and it shows the thread the user left behind.
   * Jarvis is one tap away and asks for the mic only when tapped. */
  const [mode, setMode] = useState<JarvisMode>("chat");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recordingRef = useRef<WavRecording | null>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const playbackRef = useRef<TtsPlayback | null>(null);

  const isIdle = messages.length === 0 && !isSending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isSending]);

  // Leaving the screen mid-recording or mid-sentence: release the mic and
  // the mouth. A tab that keeps recording after unmount is a privacy bug.
  useEffect(() => {
    return () => {
      recordingRef.current?.cancel();
      recordingRef.current = null;
      playbackRef.current?.stop();
      playbackRef.current = null;
      speakerRef.current?.stop();
    };
  }, []);

  /** Cut whatever Jarvis is saying right now (both mouths). */
  function stopSpeaking() {
    playbackRef.current?.stop();
    playbackRef.current = null;
    speakerRef.current?.stop();
    setIsSpeaking(false);
  }

  /** Switching halves closes the ear and the mouth first. Jarvis and chat
   * share one recorder and one voice; leaving either running across a switch
   * is how the mic ends up open on a screen that no longer shows it. */
  function changeMode(next: JarvisMode) {
    if (next === mode) return;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    setVoiceState("idle");
    stopSpeaking();
    setError(null);
    setMode(next);
  }

  /** The last thing Jarvis said — Jarvis shows it small under the orb so a
   * spoken answer can also be read. */
  const lastReply =
    [...messages].reverse().find((m) => m.role === "model")?.text ?? null;

  /** What the orb should be doing right now. Listening wins (the mic is
   * live), then the wait for Jarvis, then its speaking, then rest. */
  const orbMode: AiOrbMode =
    voiceState === "listening"
      ? "listening"
      : voiceState === "transcribing" || isSending
        ? "thinking"
        : isSpeaking
          ? "speaking"
          : "idle";

  /** Live loudness for the orb — stable identity, reads through the refs so
   * the canvas effect never rebuilds. While listening this is the mic;
   * while speaking it is the ElevenLabs playback (-1 = system TTS, no tap —
   * the orb then composes its own envelope). */
  const getLevel = useCallback(() => {
    if (recordingRef.current) return recordingRef.current.level?.() ?? 0;
    if (playbackRef.current) return playbackRef.current.level();
    return -1;
  }, []);

  async function send(text: string, options?: { spoken?: boolean }) {
    const clean = text.trim();
    if (!clean || isSending) return;
    setError(null);
    const outgoing: AgentMessage[] = [
      ...messages,
      { role: "user", text: clean },
    ];
    setMessages(outgoing);
    storeMessages(outgoing);
    setDraft("");
    setIsSending(true);
    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turns: outgoing
            .slice(-SENT_TURNS)
            .map(({ role, text: turnText }) => ({ role, text: turnText })),
        }),
      });
      const payload: {
        ok?: boolean;
        reply?: string;
        actions?: AgentAction[];
        error_sr?: string;
      } = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.reply) {
        setError(payload.error_sr ?? t("agent.error"));
        return;
      }
      const complete: AgentMessage[] = [
        ...outgoing,
        {
          role: "model",
          text: payload.reply,
          actions: payload.actions?.length ? payload.actions : undefined,
        },
      ];
      setMessages(complete);
      storeMessages(complete);
      // Spoken in -> spoken out: ElevenLabs first (the real voice, with a
      // live level for the orb), system TTS as the fallback mouth — which
      // itself returns false when the device has no ex-Yu voice; the reply
      // then simply stays on screen, orb at rest.
      if (options?.spoken) {
        void speakReply(payload.reply);
      }
    } catch {
      setError(t("agent.error"));
    } finally {
      setIsSending(false);
    }
  }

  /** Jarvis says one reply aloud: ElevenLabs when deployed, system TTS
   * when not (or when the fetch/playback fails). Never throws — a voice
   * failure costs the sound, never the conversation on screen. */
  async function speakReply(reply: string) {
    stopSpeaking();
    if (ttsAvailable) {
      try {
        const response = await fetch("/api/ai/agent/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply }),
        });
        if (response.ok) {
          const blob = await response.blob();
          playbackRef.current = await playTtsBlob(blob, {
            onEnd: () => {
              playbackRef.current = null;
              setIsSpeaking(false);
            },
          });
          setIsSpeaking(true);
          return;
        }
      } catch {
        // Fall through to the system mouth.
      }
    }
    speakerRef.current ??= createSpeaker();
    speakerRef.current.speak(reply, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  }

  /** Mic tap #1: open the ear. Must run inside the tap (permission prompt). */
  async function startListening() {
    if (voiceState !== "idle" || isSending) return;
    stopSpeaking();
    setError(null);
    try {
      recordingRef.current = await startWavRecording();
      setVoiceState("listening");
    } catch {
      setError(t("agent.voice.mic"));
    }
  }

  /** Mic tap #2: close the ear, write the sentence down, send it. */
  async function stopListening() {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setVoiceState("transcribing");
    try {
      const blob = await recording.stop();
      const formData = new FormData();
      formData.append(
        "audio",
        new File([blob], "jarvis.wav", { type: "audio/wav" })
      );
      const result = await transcribeVoiceAction(formData);
      if (!result.ok) {
        setError(result.error_sr);
        return;
      }
      await send(result.text, { spoken: true });
    } catch {
      setError(t("agent.voice.error"));
    } finally {
      setVoiceState("idle");
    }
  }

  /** Live keyboard height, so the composer sits ON the keyboard instead of
   * under it. Reports 0 everywhere the platform already handles it. */
  const keyboard = useKeyboardInset();

  const chips: { key: string; label: string }[] = [
    { key: "today", label: t("agent.chip.today") },
    { key: "dinner", label: t("agent.chip.dinner") },
    { key: "protein", label: t("agent.chip.protein") },
  ];

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-testid="agent-screen"
      aria-label={t("agent.title")}
    >
      {/* The chrome this screen has instead of the bottom navigation: settings
          on the left, the two halves in the middle. */}
      <JarvisTopBar mode={mode} onModeChange={changeMode} />

      {/* And the way out, down the right edge. Without it there is no way off
          `/ai` in an installed PWA — no bottom navigation, no browser chrome,
          no back button — so it sits outside the mode switch below and lives
          in both modes. */}
      <JarvisExitRail />

      {mode === "voice" ? (
        <JarvisVoiceMode
          orbMode={orbMode}
          getLevel={getLevel}
          voiceState={voiceState}
          isSending={isSending}
          isSpeaking={isSpeaking}
          lastReply={lastReply}
          onMicTap={() =>
            voiceState === "listening"
              ? void stopListening()
              : void startListening()
          }
          onInterrupt={stopSpeaking}
          error={error}
        />
      ) : (
        <>
          {isIdle ? (
            /* MIR: the orb is the screen — greeting from live data, three
               quiet hints. */
            <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8 pb-6">
              <AiOrbCanvas
                className="size-48"
                mode={orbMode}
                getLevel={getLevel}
              />
              <div className="flex flex-col items-center gap-2.5 text-center">
                <h1
                  className={cn(
                    jarvisVoice.className,
                    "text-2xl font-bold tracking-tight text-foreground"
                  )}
                >
                  {greeting}
                </h1>
                <p
                  className={cn(
                    jarvisVoice.className,
                    "max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground"
                  )}
                >
                  {contextLine ?? t("agent.empty")}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    data-testid={`agent-chip-${chip.key}`}
                    onClick={() => void send(chip.label)}
                    className="rounded-full border border-border bg-card px-3.5 py-2.5 text-[13px] font-medium text-foreground fm-lift hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              {error ? (
                <p
                  className="text-sm text-destructive"
                  data-testid="agent-error"
                >
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            /* RAZGOVOR: the exchange takes the screen. Spacing carries the
               grammar — the gap BETWEEN turns is twice the gap WITHIN one,
               so a question and its answer read as a single thought. */
            <div
              ref={scrollRef}
              className="flex flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 py-3"
            >
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <div
                    key={index}
                    className={cn(
                      "max-w-[78%] self-end rounded-2xl bg-muted px-3.5 py-2.5",
                      "mb-3.5 text-[14.5px] leading-[1.45] text-foreground",
                      index > 0 && PRIZMA_TURN_GAP
                    )}
                  >
                    {message.text}
                  </div>
                ) : (
                  <div key={index} className="flex flex-col">
                    <p
                      className={cn(
                        jarvisProse.className,
                        "text-[16px] leading-[1.62] whitespace-pre-wrap text-ai-prose"
                      )}
                    >
                      {message.text}
                    </p>
                    {message.actions?.length ? (
                      /* A brought flow is a shortcut, not a purchase button —
                         hairline rows, no card, no lift, no fill. */
                      <div className="mt-3.5 border-t border-border/40">
                        {message.actions.map((action, actionIndex) => (
                          <ActionRow
                            key={action.id}
                            action={action}
                            highlighted={actionIndex === 0}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              )}
              {isSending ? (
                <p
                  className={cn(
                    jarvisProse.className,
                    "animate-pulse text-[16px] leading-[1.62] text-muted-foreground"
                  )}
                >
                  {t("agent.thinking")}
                </p>
              ) : null}
              {error ? (
                <p
                  className="mt-3.5 text-sm text-destructive"
                  data-testid="agent-error"
                >
                  {error}
                </p>
              ) : null}
            </div>
          )}

          {/* The composer rides the keyboard. `bottomOffset` is a CSS
              expression, not a number that passes through React, so the card
              tracks the keyboard slide frame by frame without re-rendering
              the thread above it (see `useKeyboardInset`). */}
          <div
            className="shrink-0 px-4 pt-2"
            style={{ paddingBottom: keyboard.bottomOffset }}
          >
            <JarvisComposer
              value={draft}
              onValueChange={setDraft}
              onSubmit={() => void send(draft)}
              onMicTap={() =>
                voiceState === "listening"
                  ? void stopListening()
                  : void startListening()
              }
              voiceState={voiceState}
              isSending={isSending}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** One brought flow, as a ROW. It used to be a bordered, lifted, accent-filled
 * card with a 44px icon tile — the visual weight of a checkout button for what
 * is only a shortcut, and three of them buried the answer they belonged to.
 * Now: a bare icon, two lines of text, a hairline underneath. The
 * recommendation keeps its badge; it no longer needs a coloured slab to be
 * found, because it is simply first. */
function ActionRow({
  action,
  highlighted,
}: {
  action: AgentAction;
  highlighted: boolean;
}) {
  const { t } = useT();
  const Icon = ACTION_ICONS[action.id];
  const badge =
    action.id === "prizma_unos" ? t("agent.action.prizma_unos.badge") : null;

  return (
    /* The rule lives on the WRAPPER, never on the link. A `border-b` and a
       `rounded-lg` on one element make the hairline curve up at both ends —
       the divider stops looking like a rule and starts looking like the
       bottom of a card. The wrapper stays square and draws the line; the link
       keeps the rounding, which only ever shows while a finger is down. */
    <div className="border-b border-border/40 last:border-b-0">
      <Link
        href={action.href}
        data-testid={`agent-action-${action.id}`}
        className={cn(
          "flex items-center gap-2.5 py-2.5",
          "-mx-1.5 rounded-lg px-1.5 transition-colors active:bg-muted",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        <Icon className="size-[17px] shrink-0 text-primary" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground">
            {t(`agent.action.${action.id}.title` as MessageKey)}
          </span>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {t(`agent.action.${action.id}.desc` as MessageKey)}
          </span>
        </span>
        {badge && highlighted ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-primary">
            {badge}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
