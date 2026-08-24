import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

// A titled group of settings rows -- an iOS-style grouped list section.
// Uses the shared `Card` surface (bg-card) so it matches every other content
// card. The heading sits over `.fm-rule`, the engraved double hairline the
// plate draws under a section title.
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
        <div className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </h2>
          <span className="fm-rule mx-1" aria-hidden="true" />
        </div>
      ) : null}
      <Card className="divide-y divide-border overflow-hidden">
        {children}
      </Card>
    </section>
  );
}
