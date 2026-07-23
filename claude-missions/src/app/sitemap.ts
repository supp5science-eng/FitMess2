import type { MetadataRoute } from "next";

/**
 * `/sitemap.xml` — the public URL set we hand to Google Search Console.
 *
 * FitMess only exposes two indexable pages; the rest of the app is auth-gated
 * (see `robots.ts`). The landing page is the primary entry point; the pre-auth
 * questionnaire is a secondary marketing surface a visitor can reach and share
 * before creating an account.
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
  ];
}
