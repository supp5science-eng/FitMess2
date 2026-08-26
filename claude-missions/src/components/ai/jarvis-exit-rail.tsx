"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { pulse } from "@/lib/feel/haptic";
import { isPullArmed, pullProgress } from "@/lib/ui/pull-to-exit";
import { cn } from "@/lib/utils";

import "./jarvis-exit-rail.css";

/** Where the exit lands: the app's home screen. */
const EXIT_HREF = "/danas";

/**
 * The way out of Jarvis — a rail down the right edge, pulled upward.
 *
 * With the bottom navigation hidden and no browser chrome in an installed PWA,
 * this is the only door on the screen, which cuts both ways: it must never be
 * missed, and it must never fire by accident. A pull has a distance to it and
 * cannot be performed by a stray thumb, and the fill says how close it is the
 * whole way, so nobody has to learn where the threshold is — full red means
 * letting go leaves.
 *
 * Four things that are load-bearing rather than decorative:
 *
 * - **The progress never enters React.** It is written onto the node as the
 *   `--jer-pull` custom property, once per pointer event; only the ARMED flip
 *   is state, because that is the only thing the markup changes. Dragging
 *   re-renders nothing — the same reason `--jv-level` exists on the voice
 *   screen, where the signal is the mic instead of a finger.
 * - **It is still an `<a href>`.** An earlier cut of this made the gesture the
 *   ONLY way out, so leaving could never happen by accident. In the owner's
 *   hands that read as a broken control, which is the worse failure by a
 *   distance: something that does nothing when pressed is indistinguishable
 *   from something that is broken. So tap, Enter, Space and a page that never
 *   hydrated all still leave, and the pull is an accelerator on top of that,
 *   not a gate in front of it.
 * - **It stands beside the content, not over it.** The hit area is the 20px
 *   the screen already leaves free at its right edge, so the strip cannot
 *   swallow a tap meant for a message — which, since a stray tap here exits
 *   the screen, would be expensive.
 * - **The buzz fires on the crossing, once.** Not on every frame above the
 *   line: that is a rumble, and a rumble carries no information.
 */
export function JarvisExitRail({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const { t } = useT();
  const router = useRouter();
  const nodeRef = useRef<HTMLAnchorElement>(null);
  /** Where the finger went down; `null` whenever no drag is in flight. */
  const startY = useRef<number | null>(null);
  /** Live progress, mirrored in a ref so pointerup can read it without state. */
  const progress = useRef(0);
  /** Set when a completed pull already navigated, so the click it is followed
   *  by does not navigate a second time. */
  const consumed = useRef(false);
  const [armed, setArmed] = useState(false);

  // `data-dragging` belongs to the pointer handlers and is deliberately not
  // also declared in the JSX below: one attribute, one owner. Absent, it reads
  // as its resting state in the stylesheet, which is right for a rail nobody
  // is touching. (`data-armed` IS rendered — it follows state, which is what
  // render is for.)

  function applyProgress(next: number) {
    const wasArmed = isPullArmed(progress.current);
    const nowArmed = isPullArmed(next);
    progress.current = next;
    nodeRef.current?.style.setProperty("--jer-pull", next.toFixed(3));

    // The one moment a delegated press listener cannot see: the pull just
    // became a decision.
    if (nowArmed && !wasArmed) pulse("stamp");

    // React bails out on an unchanged value, so this costs a render only on
    // the frames where the rail crosses the threshold.
    setArmed(nowArmed);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLAnchorElement>) {
    startY.current = event.clientY;
    consumed.current = false;
    event.currentTarget.dataset.dragging = "true";
    // Capture, or the drag dies the moment the finger leaves a 20px strip.
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
    if (startY.current === null) return;
    applyProgress(pullProgress(startY.current - event.clientY));
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLAnchorElement>) {
    if (startY.current === null) return;
    const leaving = isPullArmed(progress.current);

    startY.current = null;
    event.currentTarget.dataset.dragging = "false";
    // Reset first: on the way out this leaves nothing half-red behind for the
    // back button to come home to.
    applyProgress(0);

    if (leaving) {
      // A pull that ends off the rail never produces a click, so the
      // navigation has to happen here; the flag stops the click that DOES
      // follow a pull ending on it from repeating the trip.
      consumed.current = true;
      router.push(EXIT_HREF);
    }
  }

  return (
    <>
      <Link
        ref={nodeRef}
        href={EXIT_HREF}
        draggable={false}
        data-armed={armed}
        data-testid="jarvis-exit-rail"
        aria-label={t("jarvis.close")}
        aria-describedby="jarvis-exit-hint"
        className={cn("jer-rail", className)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={(event) => {
          // The ordinary link does the ordinary thing. The one exception is
          // the click that trails a completed pull, which has already left.
          if (consumed.current) {
            consumed.current = false;
            event.preventDefault();
          }
        }}
      >
        <span className="jer-track" aria-hidden="true">
          <span className="jer-fill" />
        </span>
      </Link>
      {/* The instruction, and then the one thing that changes about it. Kept
          outside the link so it never becomes part of its accessible name. */}
      <span id="jarvis-exit-hint" className="sr-only" aria-live="polite">
        {armed ? t("jarvis.exit.armed") : t("jarvis.exit.hint")}
      </span>
    </>
  );
}
