"use client";

import { ChevronLeft } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * "Back" on a public legal page.
 *
 * The documents have two kinds of reader and they need opposite things. A
 * store reviewer opens the URL cold, with no history — for them a back button
 * is a dead control, so it is not rendered at all. Someone who tapped "uslovi
 * korišćenja" from the signup form has a half-filled form behind them, and
 * `history.back()` is the only thing that returns them to it with the typed
 * email and phone still there; the wordmark link would drop them on the
 * landing page with the form gone.
 *
 * Deciding on the client is what makes both cases work: `history.length` does
 * not exist during the server render, and guessing wrong leaves one of the two
 * readers stuck. `useSyncExternalStore` is the right shape for it — the server
 * snapshot is "no button", so the first paint never shows a control that does
 * nothing, and the value is read from the browser rather than mirrored into
 * state. Nothing subscribes, because the length of the history stack cannot
 * change while this page sits still.
 */
const NEVER_CHANGES = () => () => {};

export function LegalBackLink({ label }: { label: string }) {
  const canGoBack = useSyncExternalStore(
    NEVER_CHANGES,
    () => window.history.length > 1,
    () => false
  );

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" aria-hidden={true} />
      {label}
    </button>
  );
}
