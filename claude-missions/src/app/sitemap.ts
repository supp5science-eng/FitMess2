import type { MetadataRoute } from "next";

import {
  ACCOUNT_DELETION_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
} from "@/lib/legal/paths";

/**
 * `/sitemap.xml` — the public URL set we hand to Google Search Console.
 *
 * FitMess exposes a handful of indexable pages; the rest of the app is
 * auth-gated (see `robots.ts`). The landing page is the primary entry point;
 * the pre-auth questionnaire is a secondary marketing surface a visitor can
 * reach and share before creating an account; the three legal documents are
 * public because both stores link to them from the listing.
 */
const SITE_URL = "https://fitmess.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/upitnik`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Low priority, rarely changing — but present, so the policy URL a store
    // listing points at is one Google has actually seen.
    ...[PRIVACY_PATH, TERMS_PATH, ACCOUNT_DELETION_PATH].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
