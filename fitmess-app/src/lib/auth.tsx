import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "./supabase";

/**
 * Who is signed in, for the whole app.
 *
 * On the web this question is answered by middleware on every request, before
 * a single pixel is drawn — which is why the site can redirect a signed-out
 * visitor to `/prijava` without ever flashing the app at them. A native app
 * has no request to hook into: it starts, it draws, and only THEN can it read
 * the keychain. So the states are three, not two, and `restoring` is the one
 * that matters:
 *
 *   restoring → we do not yet know; show the splash, decide nothing
 *   session   → signed in
 *   null      → signed out
 *
 * Collapsing `restoring` into "signed out" is the classic native auth bug: the
 * app shows the sign-in screen for 200ms to a user who is already signed in,
 * every single cold start. That single flash is most of what makes an app feel
 * cheap, and it is invisible on a fast simulator.
 */

type AuthValue = {
  session: Session | null;
  /** True until the keychain has been read once. Never becomes true again. */
  restoring: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;

    // The first read. `getSession` here — not `getUser` — is deliberate: it
    // reads what is already in storage without a network round trip, so a
    // phone in a lift starts signed in rather than hanging on the splash. The
    // token is verified where it actually matters, by Postgres, on every
    // query. (Same reasoning as the web app's `getClaims` over `getUser`.)
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setRestoring(false);
    });

    // Everything after the first read — sign in, sign out, token refresh,
    // and the deep link coming back from Google or Apple — arrives here.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      // A sign-in that lands before the initial read resolves must not leave
      // the app stuck on the splash.
      setRestoring(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      restoring,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, restoring]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth mora da bude unutar <AuthProvider>.");
  return value;
}
