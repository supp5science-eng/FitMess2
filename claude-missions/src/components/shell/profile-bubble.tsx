"use client";

import { useSyncExternalStore } from "react";
import { CircleUserRound } from "lucide-react";

import { readAccounts } from "@/lib/auth/accounts";
import { cn } from "@/lib/utils";

/**
 * The Profil tab's mark: the user "as themselves" in the nav — the
 * contact-poster reading. The identity chain is, in order of preference:
 *
 *   1. profile photo   (not stored anywhere yet — slot reserved)
 *   2. avatar / memoji (the klon exists but renders no 2D thumbnail yet)
 *   3. monogram        (initial on a warm ember disc)  ← live today
 *   4. generic glyph   (no account remembered on this device)
 *
 * The initial comes from the device's own account registry
 * (`readAccounts()`, localStorage) rather than a server read: the nav is a
 * client island and must never wait on the network to paint. Wired through
 * `useSyncExternalStore` so the server snapshot is the generic glyph and the
 * client snapshot is the monogram — React swaps them at hydration without a
 * setState-in-effect cascade. Read once per page load (the nav icon does not
 * need to chase account switches live; any navigation re-reads it).
 */

/** Cached first-read of the active account's initial. `undefined` = not read
 * yet; `null` = read, no account. Module-level so the snapshot is stable
 * across renders (a fresh value every call would loop the store). */
let cachedInitial: string | null | undefined;

function clientSnapshot(): string | null {
  if (cachedInitial === undefined) {
    const email = readAccounts()[0]?.email;
    cachedInitial = email?.trim()[0]?.toUpperCase() ?? null;
  }
  return cachedInitial;
}

const emptySubscribe = () => () => {};

export function ProfileBubble({ className }: { className?: string }) {
  const initial = useSyncExternalStore(
    emptySubscribe,
    clientSnapshot,
    () => null
  );

  if (!initial) {
    return (
      <CircleUserRound
        aria-hidden="true"
        className={cn("text-current", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      data-testid="profile-bubble-monogram"
      className={cn("fm-monogram select-none", className)}
    >
      <span className="text-[11px] leading-none">{initial}</span>
    </span>
  );
}
