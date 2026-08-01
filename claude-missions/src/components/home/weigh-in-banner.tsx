"use client";

import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";

/**
 * Nedeljno merenje: the home screen's reminder that the app is waiting on a
 * weigh-in.
 *
 * A nag by design, and the only one in the app: without the reading, the whole
 * measured-TDEE feature has nothing to measure, and a plan quietly built on a
 * wrong activity multiplier just keeps being wrong. So it stays up until the
 * user weighs in.
 *
 * What it deliberately does NOT do is block anything. No modal, no dimmed
 * screen, no "you must weigh in to continue" -- someone avoiding the scale on a
 * given morning has a reason, and an app that turns that into a wall is one
 * they stop opening. It is a row you can walk past every day, and one tap when
 * you are ready.
 */
export function WeighInBanner({ daysWaiting }: { daysWaiting: number }) {
  const { t } = useT();

  const line =
    daysWaiting <= 0
      ? t("merenje.banner.today")
      : daysWaiting === 1
        ? t("merenje.banner.waitingOne")
        : t("merenje.banner.waitingMany", { days: String(daysWaiting) });

  return (
    <Link
      href="/merenje"
      data-testid="weigh-in-banner"
      className="home-body flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm transition-colors active:bg-muted/70"
    >
      <Scale className="size-5 shrink-0 text-primary" aria-hidden={true} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold text-foreground">
          {t("merenje.banner.title")}
        </span>
        <span className="text-xs text-muted-foreground">{line}</span>
      </span>
      <span className="shrink-0 text-xs font-medium text-primary">
        {t("merenje.banner.cta")}
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden={true}
      />
    </Link>
  );
}
