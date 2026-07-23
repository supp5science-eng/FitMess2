import { RemindersScreen } from "@/components/profil/reminders-screen";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

/**
 * F071: `/profil/podsetnici` — daily Web Push reminder settings (AS-116,
 * AS-118). Server Component reads the current reminder time off the
 * caller's own `profiles` row (RLS) and hands interactivity to the client
 * `RemindersScreen` (permission prompt, Push API subscribe, time picker).
 *
 * The VAPID *public* key is passed down as a prop — it is public by design
 * (it ends up inside every browser subscription); the private key never
 * leaves the server (`src/lib/push/send.ts`).
 */
export default async function PodsetniciPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  let reminderTime: string | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("reminder_time")
      .eq("user_id", userId)
      .maybeSingle();
    reminderTime = profile?.reminder_time ?? null;
  }

  const vapidPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <div className="px-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Podsetnici
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nežno gurkanje u pravo vreme — bez spama, bez griže savesti.
        </p>
      </div>

      <RemindersScreen
        initialTime={reminderTime}
        vapidPublicKey={vapidPublicKey}
      />
    </main>
  );
}
