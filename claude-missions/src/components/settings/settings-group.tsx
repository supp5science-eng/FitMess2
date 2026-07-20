import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

// A titled group of settings rows -- an iOS-style grouped list section.
// Uses the shared `Card` surface (bg-card) so it matches every other content
// card and renders correctly in both the dark and the light theme.
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
      <Card className="divide-y divide-border overflow-hidden">
        {children}
      </Card>
    </section>
  );
}
