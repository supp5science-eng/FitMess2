import type {
  AdminUserAttributes,
  AuthTokenResponsePassword,
  SignInWithPasswordCredentials,
  SupabaseClient,
  UserResponse,
} from "@supabase/supabase-js";

/**
 * F019a: shared retry-with-backoff helper for the Supabase Auth calls used
 * across `src/**\/*.integration.test.ts` (live-project integration tests).
 *
 * Those ~15+ files each create and/or sign in real users against the SAME
 * live Supabase project (no local emulator). Run back to back within a
 * single `npm run test`, this can occasionally trip Supabase Auth's
 * short-window rate limit and return a transient 429 / "rate limit
 * reached" error even after the project's own Auth rate limits have been
 * raised (see `missions/*\/connections/mcp-registry.md`). This helper is
 * belt-and-suspenders resilience on top of that: it retries ONLY when the
 * result looks like a transient rate limit, with exponential backoff +
 * jitter, a small bounded attempt count, and a hard per-attempt delay cap
 * -- never an unbounded/infinite retry loop. Any other error (wrong
 * password, RLS denial, malformed input, etc.) is returned immediately,
 * unretried, exactly as it always was.
 *
 * Generic and framework-free (no dependency on this project's `Database`
 * type) so future (M3+) integration tests can reuse it for any Supabase
 * Auth call shaped like `{ data, error }`.
 */

export interface AuthRetryOptions {
  /** Maximum number of attempts, including the first. Default 5. */
  maxAttempts?: number;
  /** Base delay (ms) before the first retry; doubles each subsequent retry. Default 300ms. */
  baseDelayMs?: number;
  /** Hard cap on any single computed delay (ms) -- backoff can never exceed this. Default 4000ms. */
  maxDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<AuthRetryOptions> = {
  maxAttempts: 5,
  baseDelayMs: 300,
  maxDelayMs: 4000,
};

/** The minimal shape every Supabase Auth error carries (status/code/message
 * are all optional depending on where in the client the error originated). */
interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

interface AuthResultLike {
  error: AuthErrorLike | null;
}

/**
 * True if `error` looks like a transient Supabase Auth rate-limit response
 * rather than a real failure (wrong password, RLS denial, unconfirmed
 * email, etc.) -- only rate-limit-shaped errors are worth retrying.
 */
export function isAuthRateLimitError(
  error: AuthErrorLike | null | undefined
): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code === "over_request_rate_limit") return true;
  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("rate limit") || message.includes("too many requests")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with full jitter, capped at `options.maxDelayMs`.
 * `attempt` is 1-based (the attempt number that just failed).
 */
function backoffDelayMs(
  attempt: number,
  options: Required<AuthRetryOptions>
): number {
  const exponential = options.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, options.maxDelayMs);
  return Math.random() * capped;
}

/**
 * Calls `operation()` and, ONLY while the result's `error` looks like a
 * transient rate limit (`isAuthRateLimitError`), retries it with
 * exponential backoff + jitter up to `options.maxAttempts` total attempts
 * (a hard cap -- never an infinite sleep loop). Any other error, or
 * exhausting all attempts, is returned as-is from the final attempt so the
 * caller's own assertions/error-handling see a clear, immediate failure
 * rather than a hang.
 */
export async function withAuthRetry<T extends AuthResultLike>(
  operation: () => Promise<T>,
  options: AuthRetryOptions = {}
): Promise<T> {
  const opts: Required<AuthRetryOptions> = { ...DEFAULT_OPTIONS, ...options };

  let result: T = await operation();
  for (
    let attempt = 1;
    isAuthRateLimitError(result.error) && attempt < opts.maxAttempts;
    attempt++
  ) {
    await sleep(backoffDelayMs(attempt, opts));
    result = await operation();
  }
  return result;
}

/**
 * `signInWithPassword`, retried on transient rate limits.
 * Usage: `const { data, error } = await signInWithPasswordRetry(client, { email, password });`
 */
export function signInWithPasswordRetry<Db = unknown>(
  client: SupabaseClient<Db>,
  credentials: SignInWithPasswordCredentials,
  options?: AuthRetryOptions
): Promise<AuthTokenResponsePassword> {
  return withAuthRetry(
    () => client.auth.signInWithPassword(credentials),
    options
  );
}

/**
 * `admin.auth.admin.createUser`, retried on transient rate limits.
 * `admin` MUST be a privileged (`sb_secret_`) client.
 */
export function adminCreateUserRetry<Db = unknown>(
  admin: SupabaseClient<Db>,
  attributes: AdminUserAttributes,
  options?: AuthRetryOptions
): Promise<UserResponse> {
  return withAuthRetry(() => admin.auth.admin.createUser(attributes), options);
}

/**
 * `admin.auth.admin.deleteUser`, retried on transient rate limits.
 * `admin` MUST be a privileged (`sb_secret_`) client.
 */
export function adminDeleteUserRetry<Db = unknown>(
  admin: SupabaseClient<Db>,
  userId: string,
  shouldSoftDelete?: boolean,
  options?: AuthRetryOptions
): Promise<UserResponse> {
  return withAuthRetry(
    () => admin.auth.admin.deleteUser(userId, shouldSoftDelete),
    options
  );
}
