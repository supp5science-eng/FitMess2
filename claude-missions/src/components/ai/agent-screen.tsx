"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowUp } from "lucide-react";

import { AiOrb } from "@/components/ai/ai-orb";
import { AiOrbCanvas } from "@/components/ai/ai-orb-canvas";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * FitMess agent — the whole AI tab (2026-08-25). Nothing but the chat:
 *
 * - While the thread is empty, the screen is the ORB — the watercolour
 *   sphere floating on the paper (`AiOrb`, the same mark as the tab icon) —
 *   with one line of copy and the quick-start chips under it.
 * - Once messages exist, the conversation takes the screen (user turns in
 *   ultramarine, the agent's on raised paper) and the orb retires until the
 *   thread is cleared.
 * - The input row is pinned to the bottom of the tab, above the nav.
 *
 * Each send POSTs the running conversation to `/api/ai/agent`, which
 * recomputes today's facts server-side (target, meals, water, profile) and
 * asks Gemini for one reply — the model talks about stored numbers, it
 * never invents them.
 *
 * The thread lives in `sessionStorage` (per app session, per device) —
 * long-term memory is a later phase; v1 keeps the thread across screen hops
 * but starts fresh tomorrow.
 */

interface AgentMessage {
  role: "user" | "model";
  text: string;
}

const STORAGE_KEY = "fm_agent_chat_v1";
/** How many trailing turns each request carries (context window discipline —
 * the server recomputes facts anyway, the model only needs recent thread). */
const SENT_TURNS = 12;

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

export function AgentScreen() {
  const { t } = useT();
  const [messages, setMessages] = useState<AgentMessage[]>(readStoredMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isEmpty = messages.length === 0 && !isSending;

  // New message / thinking state -> keep the newest line in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isSending]);

  async function send(text: string) {
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
        body: JSON.stringify({ turns: outgoing.slice(-SENT_TURNS) }),
      });
      const payload: { ok?: boolean; reply?: string; error_sr?: string } =
        await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.reply) {
        setError(payload.error_sr ?? t("agent.error"));
        return;
      }
      const complete: AgentMessage[] = [
        ...outgoing,
        { role: "model", text: payload.reply },
      ];
      setMessages(complete);
      storeMessages(complete);
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
      {isEmpty ? (
        /* The empty tab IS the orb: centrepiece, one line, three chips. */
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8 pb-6">
          <AiOrbCanvas className="size-48" />
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              {t("agent.title")}
            </h1>
            <p className="max-w-[26ch] text-sm text-muted-foreground">
              {t("agent.empty")}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                data-testid={`agent-chip-${chip.key}`}
                onClick={() => void send(chip.label)}
                className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground fm-lift hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
        /* Conversation view: a small orb keeps watch in the header row. */
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-5 py-5"
        >
          {messages.map((message, index) => (
            <MessageBubble key={index} role={message.role}>
              {message.text}
            </MessageBubble>
          ))}
          {isSending ? (
            <div className="flex items-end gap-2 self-start">
              <AiOrb className="size-7 shrink-0" />
              <MessageBubble role="model">
                <span className="animate-pulse">{t("agent.thinking")}</span>
              </MessageBubble>
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" data-testid="agent-error">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {/* Input row, pinned to the tab's bottom edge (the nav sits below in
          the shell's own row, so nothing ever overlaps). */}
      <form
        onSubmit={onSubmit}
        className="flex shrink-0 items-center gap-2.5 border-t border-border/70 bg-background px-5 py-3.5"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("agent.placeholder")}
          data-testid="agent-input"
          maxLength={2000}
          className="h-12 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={isSending || draft.trim().length === 0}
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

function MessageBubble({
  role,
  children,
}: {
  role: "user" | "model";
  children: ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "self-end rounded-br-md bg-primary text-primary-foreground"
          : "self-start rounded-bl-md border border-border bg-card text-foreground fm-lift"
      )}
    >
      {children}
    </div>
  );
}
