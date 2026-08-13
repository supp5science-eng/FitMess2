import { permanentRedirect } from "next/navigation";

import { PRIVACY_PATH } from "@/lib/legal/paths";

/**
 * `/privacy` → `/privatnost` (308).
 *
 * The English word is what people type and what gets pasted into a store form
 * from memory. A redirect rather than a second copy of the page: two URLs
 * serving the same policy is a duplicate-content problem and, worse, two
 * places for the text to drift apart. See `src/lib/legal/paths.ts`.
 */
export default function PrivacyAliasPage(): never {
  permanentRedirect(PRIVACY_PATH);
}
