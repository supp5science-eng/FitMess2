import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

/**
 * The Supabase client for the native app.
 *
 * SAME PROJECT, SAME ROWS, SAME RLS as the website. The store app is not a
 * second backend — it is a second front end onto the one the site already
 * uses, and every "own rows only" policy in Postgres applies to it unchanged.
 * That is what makes this port tractable: nothing server-side moves.
 *
 * Three differences from `claude-missions/src/lib/supabase/client.ts`, all
 * forced by the platform:
 *
 *   - THERE ARE NO COOKIES. The web client keeps the session in cookies so
 *     that Next.js middleware and server components can read it. Here the
 *     session lives in device storage and rides on an `Authorization` header.
 *   - `detectSessionInUrl` is off. There is no URL bar to read a token out of;
 *     OAuth comes back through a deep link, which is handled explicitly.
 *   - Token refresh must be told when the app is in the foreground. In a
 *     browser the timer just runs; a suspended app has no timers, so without
 *     the `AppState` hook below a phone left overnight wakes up signed out.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Loud on purpose. A missing key here does not fail at this line — it fails
  // later as an unexplained 401 on every screen at once, which is a much
  // worse thing to debug.
  throw new Error(
    "Nedostaju EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Proveri .env u korenu fitmess-app."
  );
}

/**
 * Session storage, in the OS keychain rather than plain app storage.
 *
 * ⚠️ THE 2KB TRAP. `expo-secure-store` refuses values over roughly 2048 bytes
 * on Android (KeyStore's limit), and a Supabase session is an access token, a
 * refresh token, a user object and its metadata — comfortably past that once a
 * user has a few identities linked. The failure is not a crash: the write is
 * rejected, nothing is persisted, and the app simply forgets the user on every
 * cold start, which reads as "it keeps signing me out" and has nothing in any
 * log to point at storage.
 *
 * So values are split into fixed-size chunks under `<key>.0`, `<key>.1`, … and
 * a small manifest at `<key>` records how many there are. The manifest is what
 * `getItem` reads first, so a partially written session (app killed mid-write)
 * is detected and discarded rather than half-restored.
 *
 * AsyncStorage is the fallback for the simulator and for any device where the
 * keychain is unavailable; it is not encrypted, which is acceptable only
 * because the tokens it holds are short-lived and scoped by RLS.
 */
const CHUNK_SIZE = 1800;

const secureAvailable = async () => {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
};

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (!(await secureAvailable())) return AsyncStorage.getItem(key);
    try {
      const manifest = await SecureStore.getItemAsync(key);
      if (!manifest) return null;
      const count = Number.parseInt(manifest, 10);
      // Written by an older build, or by the non-chunked path: the value is
      // the value.
      if (!Number.isInteger(count) || count < 1) return manifest;

      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`))
      );
      // A hole means the write was interrupted. Half a session is worse than
      // none — it would fail authentication in a way that looks like a server
      // problem — so drop it and let the user sign in again.
      if (parts.some((part) => part == null)) {
        await this.removeItem(key);
        return null;
      }
      return parts.join("");
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!(await secureAvailable())) return AsyncStorage.setItem(key, value);
    // Clear first: a shorter session than last time would otherwise leave
    // stale trailing chunks that the next manifest no longer counts.
    await this.removeItem(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk))
    );
    // The manifest is written LAST, so an interrupted write leaves orphan
    // chunks and no manifest — which `getItem` reads as "signed out", the safe
    // outcome — rather than a manifest pointing at chunks that do not exist.
    await SecureStore.setItemAsync(key, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (!(await secureAvailable())) return AsyncStorage.removeItem(key);
    try {
      const manifest = await SecureStore.getItemAsync(key);
      const count = Number.parseInt(manifest ?? "", 10);
      if (Number.isInteger(count) && count > 0) {
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`))
        );
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Nothing to remove, or the keychain is gone. Either way the caller's
      // intent — "this session should not be here" — is satisfied.
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    /** No URL bar to read a token from; OAuth returns via a deep link. */
    detectSessionInUrl: false,
  },
});

/**
 * Refresh only while the app is actually in front of the user.
 *
 * Without this, a backgrounded app keeps no timers, the access token expires
 * unnoticed, and the first tap after a night on the nightstand fails. With it,
 * the token is refreshed the moment the app returns to the foreground —
 * before the user's first tap has a chance to hit an expired one.
 */
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
