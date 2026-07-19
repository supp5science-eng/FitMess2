import Link from "next/link";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import { EditProfileForm } from "./edit-profile-form";

// "Izmeni podatke": the Settings sub-page where an already-onboarded user
// corrects their personal stats (name, sex, age, height, weight, activity).
// Saving recomputes the daily budget (see `src/lib/profile/update-profile.ts`).
//
// Server Component: reads the current profile via the session-scoped (RLS)
// client and hands the values to the client form as initial props. Degrades
// gracefully to a short note rather than a blank/broken screen if the read
// ever comes back empty (same posture as `/danas`, `/profil`).
export default async function PodaciPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) {
    return (
      <ErrorState message="Sesija je istekla. Prijavi se ponovo pa pokušaj ponovo." />
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, sex, birth_year, height_cm, weight_kg, activity_level")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return (
      <ErrorState message="Nismo uspeli da učitamo tvoje podatke. Pokušaj ponovo." />
    );
  }

  // `birth_year` is stored; the form edits AGE (as onboarding collected it), so
  // convert back for display. Not a day/week-boundary calc, so a plain year
  // read is fine (same as `ageYearsToBirthYear`).
  const ageYears =
    profile?.birth_year != null
      ? new Date().getFullYear() - profile.birth_year
      : null;

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/profil"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Nazad
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Lični podaci
        </h1>
        <p className="text-sm text-muted-foreground">
          Kad promeniš težinu ili aktivnost, tvoj dnevni cilj se automatski
          preračunava.
        </p>
      </header>

      <EditProfileForm
        initial={{
          name: profile?.full_name ?? null,
          sex: profile?.sex ?? null,
          ageYears,
          heightCm: profile?.height_cm ?? null,
          weightKg: profile?.weight_kg ?? null,
          activityLevel: profile?.activity_level ?? null,
        }}
      />
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Link
        href="/profil"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Nazad na podešavanja
      </Link>
    </main>
  );
}
