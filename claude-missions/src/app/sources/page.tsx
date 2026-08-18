import { permanentRedirect } from "next/navigation";

import { SOURCES_PATH } from "@/lib/legal/paths";

/**
 * `/sources` → `/izvori` (308).
 *
 * The English word is what gets typed and what gets pasted into an App Store
 * Connect reply from memory. A redirect rather than a second copy of the page:
 * one indexable URL per document, and one place for the citations to live. See
 * `src/lib/legal/paths.ts`.
 */
export default function SourcesAliasPage(): never {
  permanentRedirect(SOURCES_PATH);
}
