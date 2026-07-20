"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, RotateCcw } from "lucide-react";

import { LofiAvatar } from "@/components/agent/lofi-avatar";
import { LofiRichText } from "@/components/agent/lofi-rich-text";
import {
  LOFI_GREETING,
  LOFI_SUGGESTIONS,
  type LofiSnapshot,
} from "@/lib/ai/lofi";
import { cn } from "@/lib/utils";
import { askLofiAction } from "@/app/(app)/agent/actions";
import "./lofi.css";

// M6 (Lofi agent): the chat surface. Lofi is the in-app food buddy — you tell
// it what you're craving / how much cash you've got, and it suggests what to
// eat, grounded in your live daily budget (the header strip). The greeting is a
// UI-only first bubble (never sent to the model); `messages` holds the real
// exchange, and every send re-derives the budget server-side (`askLofiAction`).

interface Message {
  id: string;
  role: "user" | "lofi";
  text: string;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function LofiChat({ snapshot }: { snapshot: LofiSnapshot }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message / typing indicator in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, error]);

  // Auto-grow the composer up to a few lines, then scroll internally.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  async function runTurn(convo: Message[]) {
    setPending(true);
    setError(null);
    const history = convo.map((m) => ({ role: m.role, text: m.text }));
    const res = await askLofiAction(history);
    setPending(false);
    if (!res.ok) {
      setError(res.error_sr);
      return;
    }
    setMessages((prev) => [...prev, { id: uid(), role: "lofi", text: res.reply }]);
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;
    const next: Message[] = [...messages, { id: uid(), role: "user", text }];
    setMessages(next);
    setInput("");
    void runTurn(next);
  }

  function retry() {
    if (pending || messages.length === 0) return;
    void runTurn(messages);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendText(input);
    }
  }

  const showEmptyState = messages.length === 0 && !pending && !error;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      {/* Header — Lofi's identity, always visible above the scroll. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md">
        <LofiAvatar size={40} thinking={pending} />
        <div className="flex flex-col">
          <span className="text-base font-semibold leading-tight text-foreground">
            Lofi
          </span>
          <span className="text-xs leading-tight text-muted-foreground">
            {pending ? "kuca…" : "tvoj pomoćnik za obroke"}
          </span>
        </div>
      </header>

      {/* Live daily-budget strip — grounds every suggestion Lofi makes. */}
      <div className="shrink-0 px-4 pt-3">
        <BudgetStrip snapshot={snapshot} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          <LofiBubble text={LOFI_GREETING} />

          {showEmptyState ? (
            <div className="flex flex-col gap-2 pl-1">
              <span className="text-xs text-muted-foreground">Probaj ovako:</span>
              <div className="flex flex-wrap gap-2">
                {LOFI_SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendText(s)}
                    style={{ animationDelay: `${i * 55}ms` }}
                    className="lofi-chip rounded-full border border-border bg-card px-3.5 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === "lofi" ? (
              <LofiBubble key={m.id} text={m.text} />
            ) : (
              <UserBubble key={m.id} text={m.text} />
            )
          )}

          {pending ? <TypingBubble /> : null}

          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={retry}
                className="inline-flex shrink-0 items-center gap-1 font-medium"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Ponovo
              </button>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendText(input);
        }}
        className="shrink-0 border-t border-border/60 bg-background/80 px-3 py-3 backdrop-blur-md"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-border bg-card px-3 py-1.5 transition-colors focus-within:border-primary/50">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pitaj Lofija šta da jedeš…"
            aria-label="Poruka za Lofija"
            className="max-h-32 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            aria-label="Pošalji poruku"
            className="liquid-glass mb-1 grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Lofi daje procene — proveri cene i vrednosti sam.
        </p>
      </form>
    </main>
  );
}

/* ---- Bubbles ------------------------------------------------------------ */

function LofiBubble({ text }: { text: string }) {
  return (
    <div className="lofi-msg flex items-end gap-2">
      <LofiAvatar size={28} className="mb-1" />
      <div className="flex max-w-[82%] flex-col gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-[15px] leading-relaxed text-card-foreground">
        <LofiRichText text={text} />
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="lofi-msg flex justify-end">
      <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-primary/25 bg-primary/12 px-4 py-3 text-[15px] leading-relaxed text-foreground">
        {text}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="lofi-msg flex items-end gap-2">
      <LofiAvatar size={28} thinking className="mb-1" />
      <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3.5 text-primary">
        <div className="flex items-center gap-1.5" aria-label="Lofi kuca">
          <span className="lofi-dot" />
          <span className="lofi-dot" />
          <span className="lofi-dot" />
        </div>
      </div>
    </div>
  );
}

/* ---- Budget strip ------------------------------------------------------- */

function BudgetStrip({ snapshot }: { snapshot: LofiSnapshot }) {
  if (!snapshot.hasTarget) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
        Podesi svoj plan da bih znao tvoj dnevni budžet i bolje ti savetovao.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {snapshot.isOver ? "Danas" : "Ostalo danas"}
          </span>
          {snapshot.isOver ? (
            <span className="text-base font-semibold text-foreground">
              Prekoračeno{" "}
              <span className="text-sm font-normal text-muted-foreground">
                · ~{snapshot.overshootKcal} kcal preko
              </span>
            </span>
          ) : (
            <span className="text-2xl font-bold tabular-nums text-primary">
              {snapshot.remainingKcal}
              <span className="ml-1 text-sm font-medium text-muted-foreground">
                kcal
              </span>
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <MacroChip label="P" grams={snapshot.remaining.protein} color="#f9745f" />
          <MacroChip label="UH" grams={snapshot.remaining.carbs} color="#45c78d" />
          <MacroChip label="M" grams={snapshot.remaining.fat} color="#f2c14e" />
        </div>
      </div>
    </div>
  );
}

function MacroChip({
  label,
  grams,
  color,
}: {
  label: string;
  grams: number;
  color: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground"
      )}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label} {grams}g
    </span>
  );
}
