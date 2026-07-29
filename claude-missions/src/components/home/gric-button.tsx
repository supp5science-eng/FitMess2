"use client";

import Link from "next/link";
import { Mic, Plus } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

/**
 * "Gric" — the entry point for the food that otherwise never gets logged: a
 * cucumber, a handful of seeds, two apricots. It sits on the home screen next
 * to "Voda" rather than inside the "+" sheet on purpose: the moment it has to
 * serve is "my hands are full and I can't be bothered", which does not survive
 * opening a menu and choosing a method.
 *
 * A plain link, not a sheet — the flow (`/dodaj/gric`) needs a microphone and a
 * full screen for the result chips, and the whole point is that the first tap
 * lands you straight in it. Rendered only for TODAY: the flow writes rows at
 * `now()`, so it has nothing to offer while browsing an earlier day.
 */
export function GricButton() {
  const { t } = useT();
  return (
    <Link
      href="/dodaj/gric"
      data-testid="gric-open-button"
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 active:translate-y-px"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Mic className="size-5" aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-semibold text-foreground">Gric</span>
          <span className="text-xs text-muted-foreground">
            {t("home.gric.desc")}
          </span>
        </span>
      </span>
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Plus className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
