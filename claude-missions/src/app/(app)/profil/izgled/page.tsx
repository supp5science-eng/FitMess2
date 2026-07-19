import { cookies } from "next/headers";
import Link from "next/link";
import { Moon, Palette, Sun } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme/theme";

// Settings → "Izgled": pick the light or dark theme. Self-contained (only the
// committed ThemeToggle + theme helpers) so it never couples to the in-progress
// settings redesign. Server Component: reads the current theme from the
// `fm_theme` cookie and hands it to the client toggle as its initial value (no
// hydration mismatch). The toggle applies the change live + persists it.
export default async function IzgledPage() {
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 px-1">
        <Link
          href="/profil"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Nazad
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Izgled
        </h1>
        <p className="text-sm text-muted-foreground">
          Izaberi svetlu ili tamnu temu. Primenjuje se odmah.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4">
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Palette className="size-[18px]" aria-hidden={true} />
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            Tema
          </span>
        </span>
        <ThemeToggle initialTheme={theme} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ThemePreview label="Svetla" icon={Sun} light />
        <ThemePreview label="Tamna" icon={Moon} light={false} />
      </div>
    </main>
  );
}

function ThemePreview({
  label,
  icon: Icon,
  light,
}: {
  label: string;
  icon: typeof Sun;
  light: boolean;
}) {
  const surface = light ? "#ffffff" : "#0a0c0b";
  const accent = light ? "#0a0c0b" : "#17d1a8";
  const line = light ? "#e5e7e9" : "#191e20";
  const swatchBorder = light ? "#e5e7e9" : "rgba(255,255,255,0.1)";

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3">
      <div
        className="w-full rounded-xl border p-3"
        style={{ backgroundColor: surface, borderColor: swatchBorder }}
      >
        <div
          className="h-2.5 w-10 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <div
          className="mt-2 h-1.5 w-full rounded-full"
          style={{ backgroundColor: line }}
        />
        <div
          className="mt-1.5 h-1.5 w-2/3 rounded-full"
          style={{ backgroundColor: line }}
        />
      </div>
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}
