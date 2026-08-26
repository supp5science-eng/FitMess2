"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowUp,
  Camera,
  ChartColumnBig,
  Dumbbell,
  FileText,
  Home,
  Mic,
  Scale,
  Settings,
  Square,
  Target,
  type LucideIcon,
} from "lucide-react";

import { transcribeVoiceAction } from "@/app/(app)/ai/actions";
import { AiOrbCanvas, type AiOrbMode } from "@/components/ai/ai-orb-canvas";
import type { AgentActionId } from "@/lib/ai/agent-actions";
import { useT } from "@/components/i18n/locale-provider";
import { playTtsBlob, type TtsPlayback } from "@/lib/audio/play-tts";
import { startWavRecording, type WavRecording } from "@/lib/audio/record-wav";
import { createSpeaker, type Speaker } from "@/lib/audio/speak";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * Prizma — the whole AI tab (Jarvis v1, 2026-08-25, per the design canvas).
 *
 * The grammar, in one breath: the ORB is the center of the world while
 * Prizma waits (big, with a personal greeting built from live data); once a
 * conversation runs, the orb rises to the top small and the exchange takes
 * the screen — the user's line as a QUIET quote, Prizma's answer as LARGE
 * text (no chat bubbles), and under it the ACTION CARDS she brings when the
 * message asked for a deed ("hoću da logujem obrok" → Prizma unos / Slikaj /
 * Gric). Tapping a card opens the existing flow; Prizma never explains where
 * to tap.
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

  /** Cut whatever Prizma is saying right now (both mouths). */
  function stopSpeaking() {
    playbackRef.current?.stop();
    playbackRef.current = null;
    speakerRef.current?.stop();
    setIsSpeaking(false);
  }

  /** What the orb should be doing right now. Listening wins (the mic is
   * live), then the wait for Prizma, then her speaking, then rest. */
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  /** Prizma says one reply aloud: ElevenLabs when deployed, system TTS
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
        new File([blob], "prizma.wav", { type: "audio/wav" })
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

  const chips: { key: string; label: string }[] = [
    { key: "today", label: t("agent.chip.today") },
    { key: "dinner", label: t("agent.chip.dinner") },
    { key: "protein", label: t("agent.chip.protein") },
  ];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="agent-screen"
      aria-label={t("agent.title")}
    >
      {isIdle ? (
        /* MIR: the orb is the screen — greeting from live data, three quiet
           hints. */
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8 pb-6">
          <AiOrbCanvas className="size-48" mode={orbMode} getLevel={getLevel} />
          <div className="flex flex-col items-center gap-2.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}
            </h1>
            <p className="max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground">
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
                className="rounded-full border border-border bg-card px-3.5 py-2.5 text-[13px] font-medium text-foreground fm-lift hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chip.label}
              </button>
            ))}
          </div>
          {error ? (
            <p className="text-sm text-destructive" data-testid="agent-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        /* RAZGOVOR: the orb rises small; the exchange takes the screen. */
        <>
          <div className="flex shrink-0 justify-center pt-4 pb-1">
            <AiOrbCanvas className="size-16" mode={orbMode} getLevel={getLevel} />
          </div>
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-5 overflow-y-auto overscroll-y-contain px-7 py-4"
          >
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div
                  key={index}
                  className="max-w-[80%] self-end rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground"
                >
                  „{message.text}“
                </div>
              ) : (
                <div key={index} className="flex flex-col gap-3.5">
                  <p className="whitespace-pre-wrap text-[22px] font-semibold leading-snug tracking-tight text-foreground">
                    {message.text}
                  </p>
                  {message.actions?.length ? (
                    <div className="flex flex-col gap-2.5">
                      {message.actions.map((action, actionIndex) => (
                        <ActionCard
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
              <p className="animate-pulse text-[22px] font-semibold leading-snug tracking-tight text-muted-foreground">
                {t("agent.thinking")}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" data-testid="agent-error">
                {error}
              </p>
            ) : null}
          </div>
        </>
      )}

      {/* Input row, pinned above the nav. While the mic is live the text
          field gives way to the listening pill; the mic button itself flips
          into "send the clip". */}
      <form
        onSubmit={onSubmit}
        className="flex shrink-0 items-center gap-2.5 border-t border-border/70 bg-background px-5 py-3.5"
      >
        {voiceState === "listening" ? (
          <div
            data-testid="agent-listening"
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-primary/50 bg-primary/[0.06] px-4"
          >
            <span
              className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium text-foreground">
              {t("agent.listening")}
            </span>
          </div>
        ) : (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("agent.placeholder")}
            data-testid="agent-input"
            maxLength={2000}
            disabled={voiceState === "transcribing"}
            className="h-12 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />
        )}
        <button
          type="button"
          onClick={() =>
            voiceState === "listening"
              ? void stopListening()
              : void startListening()
          }
          disabled={voiceState === "transcribing" || isSending}
          aria-label={
            voiceState === "listening" ? t("agent.mic.stop") : t("agent.mic")
          }
          data-testid="agent-mic"
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:opacity-50",
            voiceState === "listening"
              ? "liquid-glass bg-primary text-primary-foreground"
              : "border border-input bg-card text-foreground hover:bg-muted"
          )}
        >
          {voiceState === "listening" ? (
            <Square className="size-4 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="size-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="submit"
          disabled={
            isSending || voiceState !== "idle" || draft.trim().length === 0
          }
          aria-label={t("agent.send")}
          data-testid="agent-send"
          className={cn(
            "liquid-glass flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:opacity-50"
          )}
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

/** One brought-flow card: icon, i18n copy, chevron-free (the whole card is
 * the tap). The first card in a group is the recommendation and carries the
 * accent treatment (and, for Prizma unos, its badge). */
function ActionCard({
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
    <Link
      href={action.href}
      data-testid={`agent-action-${action.id}`}
      className={cn(
        "flex items-center gap-3.5 rounded-xl border p-4 text-left transition-colors fm-lift",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        highlighted
          ? "border-primary/60 bg-primary/[0.08]"
          : "border-border bg-card hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          highlighted
            ? "liquid-glass bg-primary text-primary-foreground"
            : "border border-border text-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold text-foreground">
          {t(`agent.action.${action.id}.title` as MessageKey)}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {t(`agent.action.${action.id}.desc` as MessageKey)}
        </span>
      </span>
      {badge && highlighted ? (
        <span className="shrink-0 rounded-full border border-primary/50 bg-primary/15 px-2 py-1 text-[10px] font-bold tracking-wide text-primary">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
