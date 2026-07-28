import { RunRecorder } from "@/components/run/run-recorder";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * `/trcanje/snimanje` — the live recording screen.
 *
 * Server Component: resolves the caller's current body weight (newest weigh-in,
 * else the profile's stored weight) so the recorder can show a live calorie
 * estimate; all the GPS/stopwatch work happens in the client `RunRecorder`. The
 * server re-computes the authoritative totals on save regardless.
 */
export default async function SnimanjePage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  let weightKg: number | null = null;
  if (userId) {
    const [{ data: latestWeighIn }, { data: profile }] = await Promise.all([
      supabase
        .from("weigh_ins")
        .select("weight_kg")
        .eq("user_id", userId)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("weight_kg")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    weightKg = latestWeighIn?.weight_kg ?? profile?.weight_kg ?? null;
  }

  return <RunRecorder weightKg={weightKg} />;
}
