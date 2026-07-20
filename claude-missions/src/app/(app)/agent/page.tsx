import type { Metadata } from "next";

import { LofiChat } from "@/components/agent/lofi-chat";
import { buildLofiSnapshot } from "@/lib/ai/lofi";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getTodayData } from "@/lib/home/today";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lofi",
};

// M6 (Lofi agent): `/agent` -- the "Lofi" tab. Lofi is the in-app food buddy
// you chat with about what to eat. This Server Component reads the user's live
// daily budget (same `getTodayData` as `/danas`), folds it into a snapshot for
// the header strip, and hands it to the client chat. Every message the user
// sends re-derives the budget server-side (see `actions.ts`), so this initial
// snapshot only needs to be right for first paint. (Replaces the earlier
// "Uskoro" placeholder that stood in until the agent was built.)
export default async function AgentPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <p role="alert" className="text-sm text-destructive">
          Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo.
        </p>
        <a
          href="/prijava"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Prijavi se
        </a>
      </main>
    );
  }

  const result = await getTodayData(supabase, userId);
  const snapshot = buildLofiSnapshot(
    result.data?.target ?? null,
    result.data?.logs ?? []
  );

  return <LofiChat snapshot={snapshot} />;
}
