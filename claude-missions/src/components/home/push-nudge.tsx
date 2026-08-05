"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { saveWeighInEnabledAction } from "@/app/(app)/profil/podsetnici/actions";
import { recordPushPrompt } from "@/lib/funnel/record";
import {
  enablePush,
  notificationPermission,
  pushEnvironment,
} from "@/lib/push/client";

/**
 * The ask for notification permission, where the user actually is.
 *
 * Why this exists (measured 2026-08-01): 47 accounts, ONE push subscription.
 * Permission was only ever requested from Podešavanja → Podsetnici, a screen
 * nobody opens, so the entire reminder system — including the weekly weigh-in,
 * which is the one reminder the plan genuinely depends on — could reach exactly
 * one person. No wording change to a notification matters while nobody is
 * subscribed to receive it.
 *
 * Three rules it follows, all of them the reason this is a row and not another
 * overlay (the install prompt already owns that slot):
 *
 *   1. It asks only after the user has logged something TODAY. Someone who has
 *      just written down a meal has seen what the app is for; someone on their
 *      first blank screen has not, and a permission prompt they refuse is
 *      permanent — iOS gives no second prompt, only a trip into Settings.
 *   2. It asks for ONE thing: the weekly weigh-in. Not "notifications" in the
 *      abstract, which is a request without a promise, and not the daily
 *      reminders, which the user can add later if they want them.
 *   3. "Ne treba" is a real answer — 30 days of silence, and the row is
 *      dismissible without answering at all.
 *
 * Rendered only when this window can actually subscribe (`pushEnvironment`) and
 * the browser has never been asked (`permission === "default"`): a denied
 * permission cannot be re-prompted, so offering the button would be a lie.
 */

/** When the user said no. A month is long enough not to be nagging and short
 * enough that someone who changed their mind is asked again. */
const DISMISSED_KEY = "fm_push_nudge_dismissed_at";
const SILENCE_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < SILENCE_DAYS * 86_400_000;
  } catch {
    // Private mode / storage disabled: asking again beats never asking.
    return false;
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Nothing to do — the row simply comes back next time.
  }
}

type State = "offer" | "working" | "done" | "failed" | "dismissed";

/** Inlined into the client bundle at build time, like every `NEXT_PUBLIC_*`.
 * Read here rather than threaded down as a prop so this row can be dropped
 * into any client screen without changing that screen's server page. */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Whether there is anything to ask for: a window that can subscribe, a
 * browser that has never been asked, and no recent "no". */
function canOfferPush(): boolean {
  if (VAPID_PUBLIC_KEY.trim() === "") return false;
  if (pushEnvironment().state !== "ready") return false;
  if (notificationPermission() !== "default") return false;
  return !dismissedRecently();
}

/** None of the facts above change without the user acting inside this row, so
 * there is nothing to subscribe to — the same pattern the Podsetnici screen
 * uses to read browser state without a state write during render. */
const noopSubscribe = () => () => {};

/**
 * Why nothing is being offered, when nothing is.
 *
 * Returns a STRING, not `pushEnvironment()`'s object: `useSyncExternalStore`
 * compares snapshots by identity, and a fresh object every render is an
 * infinite loop.
 *
 * The case worth naming is `needs-install`. On iPhone, Apple only lets a site
 * subscribe from an installed Home Screen app, so for a user in a Safari tab
 * this row renders nothing at all — and until now that silence was invisible
 * in the numbers, indistinguishable from people seeing the offer and saying
 * no. It is not a bug to fix in this row (the app-wide install overlay already
 * asks these users to install, and a second voice about the same thing is
 * noise); it is a fact worth counting, so we learn whether the notification
 * feature is unreachable for most of the audience.
 */
function environmentState(): "server" | "ready" | "needs-install" | "unsupported" {
  if (typeof window === "undefined") return "server";
  return pushEnvironment().state;
}

export function PushNudge() {
  const { t } = useT();
  const [state, setState] = useState<State>("offer");
  const [message, setMessage] = useState<string | null>(null);

  // `false` on the server render: nothing is offered until the browser itself
  // has been consulted.
  const offerable = useSyncExternalStore(noopSubscribe, canOfferPush, () => false);
  const environment = useSyncExternalStore(
    noopSubscribe,
    environmentState,
    () => "server" as const
  );

  // What this user's device actually made possible. Written once per arrival
  // (the row is keyed on the outcome, so repeats are discarded server-side),
  // and never in a way that can fail the screen.
  useEffect(() => {
    if (offerable) {
      recordPushPrompt("shown");
      return;
    }
    // A phone that CANNOT be asked, on a screen where we would have asked.
    if (environment === "needs-install") recordPushPrompt("needs_install");
  }, [offerable, environment]);

  async function accept() {
    setState("working");
    setMessage(null);

    const subscribed = await enablePush(VAPID_PUBLIC_KEY);
    if (!subscribed.ok) {
      // "denied" is terminal in a way the others are not: the browser gives no
      // second prompt, so this user can only ever come back through the phone's
      // own settings. Worth telling apart from a network failure.
      if (subscribed.reason === "denied") recordPushPrompt("denied");
      setMessage(subscribed.message);
      setState("failed");
      return;
    }

    // Subscribed but unsaved would be the worst outcome: a device armed for a
    // reminder that is switched off. Say so rather than claim success.
    const saved = await saveWeighInEnabledAction(true);
    if (!saved.ok) {
      setMessage(saved.error_sr ?? t("home.pushNudge.error"));
      setState("failed");
      return;
    }

    recordPushPrompt("accepted");
    setState("done");
  }

  function decline() {
    recordPushPrompt("declined");
    rememberDismissed();
    setState("dismissed");
  }

  // "done" outlives `offerable` on purpose: granting permission flips that
  // store to false, and the confirmation is the whole point of the exchange.
  if (state !== "done" && (!offerable || state === "dismissed")) return null;

  if (state === "done") {
    return (
      <p
        data-testid="push-nudge-done"
        className="home-body rounded-2xl border border-border bg-muted/40 px-4 py-3.5 text-sm text-muted-foreground backdrop-blur-xl"
      >
        {t("home.pushNudge.done")}
      </p>
    );
  }

  return (
    <div
      data-testid="push-nudge"
      className="home-body flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3.5 backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden={true} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground">
            {t("home.pushNudge.title")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("home.pushNudge.body")}
          </span>
        </span>
        {/* Dismiss without answering: this row must never be a wall. */}
        <button
          type="button"
          onClick={decline}
          aria-label={t("home.pushNudge.decline")}
          data-testid="push-nudge-close"
          className="-m-1 shrink-0 p-1 text-muted-foreground"
        >
          <X className="size-4" aria-hidden={true} />
        </button>
      </div>

      {message ? (
        <p role="alert" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void accept()}
          disabled={state === "working"}
          data-testid="push-nudge-accept"
          className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {state === "working"
            ? t("home.pushNudge.working")
            : t("home.pushNudge.accept")}
        </button>
        <button
          type="button"
          onClick={decline}
          className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
        >
          {t("home.pushNudge.decline")}
        </button>
      </div>
    </div>
  );
}
