import { NextResponse } from "next/server";

import {
  PHONE_PROMPT_COOKIE,
  PHONE_PROMPT_COOKIE_MAX_AGE,
} from "@/lib/auth/phone-prompt";
import { createClient } from "@/lib/supabase/server";

/**
 * "Preskoči" on `/telefon` — a plain GET, on purpose.
 *
 * ## Why this is a route handler and not the Server Action it used to be
 *
 * The skip was a second `<form action={skipPhoneAction}>` next to the save
 * form. On a device it did nothing: the save button submitted, the skip button
 * did not, and the user sat on a screen whose only visible way out was dead.
 * The two forms POST to the same URL and run the same three lines of server
 * code, so nothing about the *server* explains the difference — which is the
 * point. The skip is the one control on this screen that App Store guideline
 * 5.1.1(v) requires to work, and it was riding on the most machinery: React
 * hydration, a build-scoped action id, a POST the service worker declines to
 * touch, and a 303 the web view has to follow.
 *
 * A link needs none of that. It works before the page hydrates, it works if
 * the JS bundle never arrives, and there is no encoding to mismatch after a
 * deploy. For a control whose entire job is "let me out of here", the cheapest
 * mechanism that can possibly work is the correct one.
 *
 * Setting a cookie on a GET is normally a smell. Here the cookie carries a UI
 * preference ("I was asked and said no", see `@/lib/auth/phone-prompt`), not
 * user data: replaying this URL a second time changes nothing, and the worst a
 * stray prefetch can do is dismiss an optional prompt the user was about to
 * dismiss anyway. That is why the form links here with a plain `<a>` rather
 * than `next/link` — no prefetch, no speculative skip.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // No session: this URL is only ever reached from a page the middleware gates
  // to signed-in users, so this is a stale tab or a hand-typed URL. Sending it
  // to `/danas` would bounce to `/prijava` anyway; go there directly.
  if (!user) {
    return NextResponse.redirect(new URL("/prijava", request.url));
  }

  const response = NextResponse.redirect(new URL("/danas", request.url));
  response.cookies.set(PHONE_PROMPT_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PHONE_PROMPT_COOKIE_MAX_AGE,
  });
  return response;
}
