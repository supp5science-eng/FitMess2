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
};

export default nextConfig;
