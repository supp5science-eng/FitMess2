// Client-side registry of accounts remembered ON THIS DEVICE, powering the
// "Promeni nalog" (switch account) feature. Each entry keeps just enough to
// switch back into that account without re-typing a password: its user id,
// email (for display) and current refresh token.
//
// SECURITY NOTE: the refresh token is stored in localStorage. In this app that
// is NOT a new exposure — `@supabase/ssr` already keeps the ACTIVE session
// (refresh token included) in JS-readable cookies so the browser client can
// refresh it. So a remembered account sits at the same exposure level as the
// currently signed-in one. Switching without a password is the explicit
// product choice (family sharing a phone, personal + secondary account); the
// "Ukloni sa uređaja" action exists so a shared/borrowed device can be wiped.
//
// Refresh tokens ROTATE on every use, so a stale stored token triggers
// Supabase's reuse-detection and gets the account revoked. Everything that
// obtains a fresh session (the app-wide `AccountsSync`, and the switch action
// itself) MUST call `upsertAccount` with the newest token so the registry
// never holds a spent one.

const STORAGE_KEY = "fm_accounts";
/** Cap so the registry can't grow unbounded; oldest-used entries drop off. */
const MAX_ACCOUNTS = 6;

export interface RememberedAccount {
  /** Supabase `auth.users.id` — the stable key across email changes. */
  id: string;
  email: string;
  /** Current (un-spent) refresh token for this account on this device. */
  refreshToken: string;
  /** Epoch ms of the last time we refreshed/used this account — drives both
   * the display order (most recent first) and which entry is evicted at cap. */
  updatedAt: number;
}

function isRememberedAccount(value: unknown): value is RememberedAccount {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.email === "string" &&
    typeof v.refreshToken === "string" &&
    typeof v.updatedAt === "number"
  );
}

/** All remembered accounts, most-recently-used first. Safe on the server
 * (returns `[]`) and against a corrupted/foreign value in the key. */
export function readAccounts(): RememberedAccount[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRememberedAccount)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeAccounts(list: RememberedAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full / blocked (private mode): the switcher just won't remember
    // this account — never throw into a caller's auth flow.
  }
}

/** Insert or refresh an account, keeping the newest token and bumping it to the
 * front. Enforces the `MAX_ACCOUNTS` cap by dropping the least-recently-used. */
export function upsertAccount(input: {
  id: string;
  email: string;
  refreshToken: string;
}): void {
  const now = Date.now();
  const others = readAccounts().filter((a) => a.id !== input.id);
  const next: RememberedAccount[] = [
    { id: input.id, email: input.email, refreshToken: input.refreshToken, updatedAt: now },
    ...others,
  ].slice(0, MAX_ACCOUNTS);
  writeAccounts(next);
}

/** Forget one account on this device (does NOT delete the account itself). */
export function removeAccount(id: string): void {
  writeAccounts(readAccounts().filter((a) => a.id !== id));
}
