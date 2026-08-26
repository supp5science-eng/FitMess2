"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Plus, Square } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Jarvis's composer — the field you write in (2026-08-26 redesign).
 *
 * What it replaces: a ROW of three separate things above a hairline — a text
 * pill, a round mic, a round send. Three floating objects read as a toolbar,
 * and a toolbar is not a place to write. Perplexity's answer, and now ours, is
 * ONE CARD: the text owns the whole top line of the card, and the controls sit
 * on a second line INSIDE the same card — `+` on the left, mic and send on the
 * right. Tap it and the card grows with the sentence instead of scrolling a
 * one-line pill sideways.
 *
 * The field is a `<textarea>`, not an `<input>`, for exactly that reason: it
 * starts at one line and grows to five before it takes its own scrollbar (see
 * the auto-grow effect). `Enter` sends, `Shift+Enter` breaks the line, and the
 * phone keyboard's action key says "send" (`enterKeyHint`).
 *
 * It owns no state but its own height and focus: the draft, the mic and the
 * request all live in the screen above it. Sending does NOT clear the field
 * either — the caller does that once the turn is actually accepted, so a
 * failed send never eats the sentence.
 */

/**
 * Focus rings on this screen are drawn as an OUTLINE, not as Tailwind's
 * `ring-*`, on anything that carries `.fm-lift` or `.liquid-glass`. Both of
 * those are unlayered rules in `globals.css` that set `box-shadow` outright,
 * and unlayered author CSS beats anything inside Tailwind's `utilities` layer
 * no matter the specificity — so a `ring-*` on a lifted control is silently
 * swallowed by the lift. `outline` is a different property, so it always
 * shows, and `outline-ring` is the same theme token the rings use.
 */
const FOCUS_OUTLINE =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The two quiet round buttons in the control row (`+` and the idle mic). */
const GHOST_BUTTON_CLASS = cn(
  "flex size-9 shrink-0 items-center justify-center rounded-full",
  "border border-border bg-card text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground focus-visible:outline-none",
  "disabled:pointer-events-none disabled:opacity-45",
  FOCUS_OUTLINE
);

/** Five lines at 24px, the point where the card stops growing and scrolls. */
const MAX_FIELD_HEIGHT = "max-h-[7.5rem]";

export function JarvisComposer({
  value,
  onValueChange,
  onSubmit,
  onMicTap,
  voiceState,
  isSending,
  disabled = false,
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  /** Called when the user sends. The composer does NOT clear the field. */
  onSubmit: () => void;
  /** Mic tap — the screen above decides whether that starts or ends a take. */
  onMicTap: () => void;
  voiceState: "idle" | "listening" | "transcribing";
  isSending: boolean;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element {
  const { t } = useT();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const isListening = voiceState === "listening";
  const canSend =
    !disabled && !isSending && voiceState === "idle" && value.trim().length > 0;

  // AUTO-GROW. The height is collapsed to `auto` BEFORE it is measured:
  // `scrollHeight` only ever reports the content's full height against the
  // current box, so measuring without the reset ratchets the card upwards and
  // never lets it come back down after a delete. The inline height may exceed
  // the five-line cap; `max-h` then wins on screen and the field scrolls
  // inside itself. Re-runs on `voiceState` too, because the field is unmounted
  // while the mic is live and comes back with a fresh, unmeasured box.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value, voiceState]);

  function submit() {
    if (!canSend) return;
    onSubmit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // `isComposing` is the IME guard: mid-composition Enter picks a candidate
    // word, it does not end a sentence.
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    /* The ring lives on this outer shell and the card's lift on the inner one.
       They cannot share an element: `.fm-lift` is unlayered CSS and would eat
       a `ring-*` box-shadow whole (see FOCUS_OUTLINE above). A ring costs no
       layout either way, so the card never shifts when it is tapped. */
    <div
      data-testid="jarvis-composer"
      className={cn(
        "rounded-3xl transition-shadow duration-150",
        isFocused && "ring-3 ring-ring/45",
        className
      )}
    >
      <div className="fm-lift rounded-3xl border border-border bg-card px-3 pt-3 pb-2.5">
        {isListening ? (
          /* The mic is live: the field steps aside for one quiet line. Same
             24px height as the collapsed textarea, so the card holds still. */
          <div
            data-testid="agent-listening"
            role="status"
            aria-live="polite"
            className="flex h-6 items-center gap-2 px-1"
          >
            <span
              className="size-2 shrink-0 animate-pulse rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className="truncate text-[15px] font-medium text-foreground">
              {t("jarvis.voice.listening")}
            </span>
          </div>
        ) : (
          <textarea
            ref={fieldRef}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={1}
            maxLength={2000}
            enterKeyHint="send"
            disabled={disabled || voiceState === "transcribing"}
            placeholder={t("jarvis.composer.placeholder")}
            aria-label={t("jarvis.composer.placeholder")}
            data-testid="agent-input"
            className={cn(
              "block w-full resize-none overflow-y-auto bg-transparent px-1",
              // 16px is not a taste call: anything smaller and iOS Safari
              // zooms the page in when the field takes focus.
              "text-[16px] leading-6 text-foreground",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-60",
              MAX_FIELD_HEIGHT
            )}
          />
        )}

        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            aria-label={t("jarvis.composer.attach")}
            data-testid="jarvis-composer-attach"
            disabled={disabled}
            onClick={() => {
              // Visual only for now — the orchestrator wires the photo flow.
            }}
            className={GHOST_BUTTON_CLASS}
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1" />

          <button
            type="button"
            onClick={onMicTap}
            disabled={disabled || voiceState === "transcribing" || isSending}
            aria-label={
              isListening
                ? t("jarvis.composer.stop")
                : t("jarvis.composer.voice")
            }
            data-testid="agent-mic"
            className={cn(
              isListening
                ? cn(
                    "liquid-glass flex size-9 shrink-0 items-center justify-center rounded-full",
                    "bg-primary text-primary-foreground",
                    "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45",
                    FOCUS_OUTLINE
                  )
                : GHOST_BUTTON_CLASS
            )}
          >
            {isListening ? (
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            ) : (
              <Mic className="size-5" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={t("jarvis.composer.send")}
            data-testid="agent-send"
            className={cn(
              "liquid-glass flex size-10 shrink-0 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-40",
              FOCUS_OUTLINE
            )}
          >
            <ArrowUp className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
