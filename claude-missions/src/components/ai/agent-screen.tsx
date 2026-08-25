"use client";

import {
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
  Target,
  type LucideIcon,
} from "lucide-react";

import { AiOrbCanvas } from "@/components/ai/ai-orb-canvas";
import type { AgentActionId } from "@/lib/ai/agent-actions";
import { useT } from "@/components/i18n/locale-provider";
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
 * voice input (Faza C) and mutating actions with confirmation (v2) are
 * deliberately not here yet.
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
}: {
  /** "Dobro jutro, Marko." — composed server-side from the profile. */
  greeting: string;
  /** "Do sada 1.250 kcal — ostalo ti je 650." or null when unknown. */
  contextLine: string | null;
}) {
  const { t } = useT();
  const [messages, setMessages] = useState<AgentMessage[]>(readStoredMessages);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isIdle = messages.length === 0 && !isSending;

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
      {isIdle ? (
        /* MIR: the orb is the screen — greeting from live data, three quiet
           hints. */
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-8 pb-6">
          <AiOrbCanvas className="size-48" />
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
            <AiOrbCanvas className="size-16" />
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
                  „{message.text}"
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

      {/* Input row, pinned above the nav. Voice (mikrofon) lands in Faza C. */}
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
