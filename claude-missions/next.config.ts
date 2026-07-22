import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `SUPABASE_PUBLISHABLE_KEY` is a publishable key (safe to ship to the
  // browser, same trust model as the legacy Supabase `anon` key -- RLS is
  // the real access control) but it isn't prefixed `NEXT_PUBLIC_` in .env.
  // Re-expose it to the client bundle here instead of renaming it in .env.
  // `NEXT_PUBLIC_SUPABASE_URL` needs no help; Next.js inlines it already.
  env: {
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  },
  experimental: {
    // Default Server Action body limit is 1MB. "iPeach mtd" posts a photo AND
    // an audio clip in one action (each up to ~2MB), so the combined payload
    // can exceed 1MB -- which silently rejected the request before the action
    // ran and left the flow spinning forever. 10MB comfortably covers image +
    // audio for every logging flow.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
