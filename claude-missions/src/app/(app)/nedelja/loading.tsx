// F041: `/nedelja` loading skeleton -- mirrors the dashboard's layout
// (header, hero ring card, two stat cards, per-day chart card) so the shell
// stays stable while the server read resolves. No client JS.
export default function NedeljaLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-6">
        <div className="size-52 animate-pulse rounded-full bg-muted" />
        <div className="h-8 w-36 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="flex gap-3">
        <div className="h-24 flex-1 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 flex-1 animate-pulse rounded-2xl bg-muted" />
      </div>

      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
