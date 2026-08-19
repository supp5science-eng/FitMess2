import { headers } from "next/headers";

import {
  isIosNativeShellUserAgent,
  isNativeAppUserAgent,
} from "@/lib/device/native";

/**
 * "Is this request coming from the App Store / Play shell?", for server
 * components.
 *
 * The middleware already answers this per request (`src/middleware.ts`), but a
 * page that needs the answer to decide what to RENDER cannot reach into the
 * middleware's decision — it has to read the header itself. Same single source
 * of truth underneath (`isNativeAppUserAgent`), so the two can never disagree
 * about what a shell looks like.
 */
export async function isNativeShellRequest(): Promise<boolean> {
  try {
    const h = await headers();
    return isNativeAppUserAgent(h.get("user-agent"));
  } catch {
    // `headers()` throws when called outside a request scope -- e.g. a unit
    // test rendering a server component in isolation. Degrade to "browser",
    // which is the answer that hides nothing: the same reasoning (and the same
    // shape) as `getLocale()` in `@/lib/i18n/server`.
    return false;
  }
}

/**
 * "Is this the iOS shell?", for server components — the question the sign-in
 * screens ask to decide whether to offer Google (see
 * `isIosNativeShellUserAgent` for why the answer is per platform).
 */
export async function isIosNativeShellRequest(): Promise<boolean> {
  try {
    const h = await headers();
    return isIosNativeShellUserAgent(h.get("user-agent"));
  } catch {
    return false;
  }
}
