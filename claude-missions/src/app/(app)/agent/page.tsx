import { Bot } from "lucide-react";
import Link from "next/link";

/**
 * "Uskoro" (coming soon) placeholder for the FitMess Agent -- the bottom
 * nav's third tab (`src/components/shell/bottom-nav.tsx`) has always pointed
 * to `/agent`, but the conversational agent (M6 / F050-F058) isn't built yet.
 * Until it lands, the tab resolves to this clear Serbian placeholder instead
 * of a broken 404, exactly like the `/dodaj/uskoro/[metoda]` placeholder the
 * add-sheet's not-yet-built methods use.
 *
 * Static server component inside the `(app)` route group, so it inherits the
 * auth middleware and the app shell (bottom nav, safe areas). A future
 * F050+ replaces this page with the real agent chat; the nav entry needs no
 * change.
 */
export default function AgentUskoroPage() {
  return (
    <main
      data-testid="agent-uskoro-page"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"
      >
        <Bot className="size-7" />
      </span>
      <span
        data-testid="agent-uskoro-badge"
        className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
      >
        Uskoro
      </span>
      <h1 className="text-lg font-semibold text-foreground">FitMess Agent</h1>
      <p
        data-testid="agent-uskoro-body"
        className="max-w-xs text-sm text-muted-foreground"
      >
        Uskoro ćeš moći da pričaš sa agentom: upišeš obrok jednom rečenicom,
        pitaš šta da jedeš i dobiješ savet u sekundi.
      </p>
      <Link
        href="/danas"
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Nazad na Danas
      </Link>
      <Link
        href="/dodaj/pretraga"
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        Dodaj obrok pretragom
      </Link>
    </main>
  );
}
