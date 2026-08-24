"use client";

import { useSyncExternalStore } from "react";

import {
  getClickSoundServerSnapshot,
  isClickSoundOn,
  playClick,
  setClickSoundOn,
  subscribeClickSound,
} from "@/lib/feel/click-sound";
import { cn } from "@/lib/utils";

/**
 * The off switch for the click sound.
 *
 * It exists because the sound fires on EVERY tap of a food diary, and a phone
 * that clicks in a meeting is a one-star review. The preference is per-device
 * (`localStorage`, not the profile row): whether a tap should make noise is a
 * property of the phone and the room it is in, not of the account.
 *
 * Hydration: the server cannot read `localStorage`, so `useSyncExternalStore`
 * renders the server snapshot ("on", the default) and swaps to the real value
 * on hydration. Someone who had muted the app sees the switch correct itself
 * once on this screen, which is the cheaper of the two costs; the alternative
 * is rendering nothing until mounted, which makes the row jump.
 *
 * Turning it ON plays the sound immediately, so the answer to "what does this
 * do" is the switch itself rather than a line of description.
 */
export function SoundToggle({ label }: { label: string }) {
  const on = useSyncExternalStore(
    subscribeClickSound,
    isClickSoundOn,
    getClickSoundServerSnapshot
  );

  function toggle() {
    const next = !on;
    setClickSoundOn(next);
    // Only on the way up: a confirmation noise for "silence, please" would be
    // a small joke at the user's expense.
    if (next) playClick("stamp");
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        on
          ? "border-transparent bg-primary"
          : "border-border bg-muted"
      )}
    >
      <span
        aria-hidden={true}
        className={cn(
          "pointer-events-none block size-6 rounded-full bg-card shadow-[0_1px_2px_rgba(8,7,52,0.35)] transition-transform",
          on ? "translate-x-[23px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}
