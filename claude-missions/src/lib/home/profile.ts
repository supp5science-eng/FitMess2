import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { ActivityLevel, Sex } from "@/lib/types/db";

/**
 * The slice of the signed-in user's `profiles` row that the `/danas` header
 * (`layout.tsx`) and body (`page.tsx`) both need: the sign-up day (strip lower
 * bound), plus the body stats that drive the adaptive plan, the step goal and
 * the water goal.
 */
export interface DanasProfile {
  created_at: string | null;
  sex: Sex | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
}

/**
 * Reads the current user's `profiles` row ONCE per request, shared across the
 * `/danas` layout and page.
 *
 * The header (layout) needs `created_at` (the strip's sign-up lower bound) and
 * the body (page) needs `sex`/`weight_kg`/`activity_level` (adaptive plan +
 * step/water goals). Before this, the layout and the page each fired their own
 * `profiles` read on every load -- the same single row fetched twice per
 * navigation. Wrapping the read in React's `cache()` memoizes it for the
 * duration of one server request, so the layout and the page (which render in
 * the same request) now share a single round trip. A `null` return (no row /
 * read error) degrades exactly as the old inline reads did: callers fall back
 * to their documented defaults.
 *
 * Creates its own session-bound RLS client so the memo key is just `userId`
 * (React `cache()` keys on argument identity -- passing a per-call `supabase`
 * client would defeat the dedup). `createClient()` only reads the request's
 * cookies; it makes no network call of its own.
 */
export const getDanasProfile = cache(
  async (userId: string): Promise<DanasProfile | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("created_at, sex, weight_kg, activity_level")
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  }
);
