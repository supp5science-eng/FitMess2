import type { ReactNode } from "react";

// A titled group of settings rows -- an iOS-style grouped list section.
// Theme-token based (bg-card / border-border / text-muted-foreground) so it
// renders correctly in both the dark and the light theme.
export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      {title ? (
        <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}
