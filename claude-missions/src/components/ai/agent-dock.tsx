"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUp, X } from "lucide-react";

import { AddSheet } from "@/components/home/add-sheet";
import { EmberOrb } from "@/components/shell/ember-orb";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * FitMess agent, faza 2 (2026-08-25): the AI tab's floating dock and chat.
 *
 * The dock is one row floating over the AI tab's content (positioned by
 * `AppShell`): a chat pill ("Pitaj AI…") that opens the conversation, and the
 * existing "+" (AddSheet) beside it — ask or log, the tab's two verbs, side
 * by side.
 *
 * The chat itself is a full-height sheet (portal to <body>, same overlay
 * pattern as `AddSheet`): conversation on top, quick-start chips while it is
 * empty, an input row pinned to the bottom. Each send POSTs the running
 * conversation to `/api/ai/agent`, which recomputes today's facts server-side
 * and asks Gemini for one reply.
 *
 * The conversation lives in `sessionStorage` (per app session, per device) —
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

export function AgentDock() {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="pointer-events-auto flex items-center gap-3">
        {/* The chat pill: reads as an input, acts as a button. */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          data-testid="agent-dock-open"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="liquid-glass flex h-14 flex-1 items-center gap-3 rounded-full border border-border bg-card/90 px-4 text-left shadow-[0_8px_30px_rgba(60,8,3,0.45)] backdrop-blur-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <EmberOrb className="size-7 shrink-0" />
          <span className="truncate text-sm text-muted-foreground">
            {t("agent.dock.cta")}
          </span>
        </button>
        <AddSheet />
      </div>

      {isOpen ? <AgentChatSheet onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

function AgentChatSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [messages, setMessages] = useState<AgentMessage[]>(readStoredMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // New message / thinking state -> keep the newest line in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isSending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  if (typeof document === "undefined") return null;

  const chips: { key: string; label: string }[] = [
    { key: "today", label: t("agent.chip.today") },
    { key: "dinner", label: t("agent.chip.dinner") },
    { key: "protein", label: t("agent.chip.protein") },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="agent-chat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-chat-title"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-[430px] flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
          <EmberOrb className="size-8 shrink-0" />
          <h2
            id="agent-chat-title"
            className="flex-1 text-lg font-semibold text-foreground"
          >
            {t("agent.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="agent-chat-close"
            aria-label={t("home.close")}
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {/* Conversation */}
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-5 py-5"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agent.empty")}</p>
          ) : null}
          {messages.map((message, index) => (
            <MessageBubble key={index} role={message.role}>
              {message.text}
            </MessageBubble>
          ))}
          {isSending ? (
            <MessageBubble role="model">
              <span className="animate-pulse">{t("agent.thinking")}</span>
            </MessageBubble>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" data-testid="agent-error">
              {error}
            </p>
          ) : null}
        </div>

        {/* Quick-start chips, only while the thread is empty. */}
        {messages.length === 0 && !isSending ? (
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                data-testid={`agent-chip-${chip.key}`}
                onClick={() => void send(chip.label)}
                className="rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Input row */}
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2.5 border-t border-border/70 px-5 py-3.5"
        >
          <input
            ref={inputRef}
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
    </div>,
    document.body
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
          : "self-start rounded-bl-md border border-border bg-card text-foreground"
      )}
    >
      {children}
    </div>
  );
}
