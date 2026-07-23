"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import { upsertAccount } from "@/lib/auth/accounts";

/**
 * Invisible, app-wide keeper of the multi-account registry.
 *
 * Mounted inside the authenticated app shell, it records the CURRENT account
 * into the on-device registry and, crucially, keeps its stored refresh token
 * up to date: it captures the session on mount and re-captures on every
 * `onAuthStateChange` that yields a fresh token (`SIGNED_IN`,
 * `TOKEN_REFRESHED`, `INITIAL_SESSION`, `USER_UPDATED`). Because refresh
 * tokens rotate on use, this is what stops the registry from ever holding a
 * spent token (which Supabase would treat as reuse and revoke). See
 * `@/lib/auth/accounts` for the storage + security notes.
 *
 * Renders nothing.
 */
export function AccountsSync() {
  useEffect(() => {
    const supabase = createClient();

    function capture(session: {
      user: { id: string; email?: string | null };
      refresh_token: string;
    } | null) {
      if (session?.user?.email && session.refresh_token) {
        upsertAccount({
          id: session.user.id,
          email: session.user.email,
          refreshToken: session.refresh_token,
        });
      }
    }

    // Immediate capture (covers the just-signed-in redirect landing here).
    supabase.auth.getSession().then(({ data }) => capture(data.session));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "INITIAL_SESSION" ||
        event === "USER_UPDATED"
      ) {
        capture(session);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
