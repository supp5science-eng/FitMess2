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
 *
 * ## The minimalism pass (owner review, 2026-08-26)
 *
 * The card above was right in structure and wrong in weight. Side by side with
 * Perplexity's it had FOUR competing edges — a hairline border, a letterpress
 * lift, a 3 px focus ring, and two more bordered white discs around `+` and
 * the mic — around what is one place to write a sentence. The owner's word for
 * the difference was "minimalistički", and every change below is that one
 * note:
 *
 * - **One surface, no edges.** The card is a tint (`bg-muted`) on the white
 *   ground instead of a white card outlined and lifted off it. The shape is
 *   read from the fill, the way Perplexity's is, so nothing has to be drawn
 *   around it. Focus is a 2 px ring at low alpha — present, not shouting.
 * - **One button, not three.** `+` and the mic lose their discs and become
 *   bare icons; only send keeps its filled circle, so the eye lands on the one
 *   control that ends the turn. ("button ostavi" — the send button stays.)
 * - **The sentence is set as TEXT.** The field is `--ai-prose`, the near-black
 *   ink Jarvis's own answers use, not the ultramarine `--foreground` every
 *   label in the app is drawn in: a whole sentence in ultramarine reads as a
 *   coloured block rather than as something being said, and what is typed here
 *   is a sentence. The placeholder sits back a step from it.
 * - **The air comes out.** The card had a 10 px band of nothing between the
 *   sentence and the controls, on top of generous padding all round — the
 *   "preveliki razmak". Both are tighter now, so the card is a place to write
 *   rather than a panel with a field in it.
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

/**
 * The two quiet controls in the row (`+` and the idle mic).
 *
 * BARE icons, deliberately: they used to be bordered white discs, which put
 * three circles in a nine-centimetre-wide card and made the row read as a
 * toolbar again. The tap target is still 36 px — only the ring around it is
 * gone, so the one circle left in the card is the send button.
 */
const GHOST_BUTTON_CLASS = cn(
  "flex size-9 shrink-0 items-center justify-center rounded-full",
  "bg-transparent text-muted-foreground transition-colors",
  "hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none",
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
    /* Two elements still, even with the lift gone: the ring is a `box-shadow`
       and `.liquid-glass` on the send button lives in unlayered CSS, so keeping
       the ring on its own shell is what stops a future surface rule from eating
       it (see FOCUS_OUTLINE above). A ring costs no layout, so the card never
       shifts when it is tapped. */
    <div
      data-testid="jarvis-composer"
      className={cn(
        "rounded-[26px] transition-shadow duration-150",
        isFocused && "ring-2 ring-ring/25",
        className
      )}
    >
      <div className="rounded-[26px] bg-muted px-2.5 pt-2.5 pb-2">
        {isListening ? (
          /* The mic is live: the field steps aside for one quiet line. Same
             24px height as the collapsed textarea, so the card holds still. */
          <div
            data-testid="agent-listening"
            role="status"
            aria-live="polite"
            className="flex h-6 items-center gap-2 px-1.5"
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
              "block w-full resize-none overflow-y-auto bg-transparent px-1.5",
              // 16px is not a taste call: anything smaller and iOS Safari
              // zooms the page in when the field takes focus.
              // `text-ai-prose` and not `text-foreground`: see the minimalism
              // pass at the top of this file.
              "text-[16px] leading-6 text-ai-prose caret-primary",
              "placeholder:text-muted-foreground/70 focus:outline-none",
              "disabled:opacity-60",
              MAX_FIELD_HEIGHT
            )}
          />
        )}

        <div className="mt-1 flex items-center gap-1">
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
            <Plus className="size-[19px]" aria-hidden="true" />
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
              <Mic className="size-[19px]" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label={t("jarvis.composer.send")}
            data-testid="agent-send"
            className={cn(
              "liquid-glass flex size-9 shrink-0 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-40",
              FOCUS_OUTLINE
            )}
          >
            <ArrowUp className="size-[19px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
