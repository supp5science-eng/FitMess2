import { permanentRedirect } from "next/navigation";

import { TERMS_PATH } from "@/lib/legal/paths";

/**
 * `/terms` → `/uslovi` (308). See `src/app/privacy/page.tsx` for why these
 * aliases redirect instead of rendering their own copy.
 */
export default function TermsAliasPage(): never {
  permanentRedirect(TERMS_PATH);
}
