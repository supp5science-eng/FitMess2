"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RunRoutePoint } from "@/lib/types/db";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "paused"
  | "saving"
  | "denied";

export interface RunPayload {
  startedAt: string;
  endedAt: string;
  points: RunRoutePoint[];
}

export interface RunRecorder {
  status: RecorderStatus;
  points: RunRoutePoint[];
  /** Active (non-paused) elapsed milliseconds, ticking once a second. */
  elapsedMs: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Stop tracking and return the payload to POST (null if nothing to save). */
  finalize: () => RunPayload | null;
}

// Minimal Wake Lock typing (not in every TS DOM lib). Best-effort: keeps the
// screen awake while recording so the GPS trace isn't cut off by the display
// sleeping; silently absent where unsupported.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}
interface WakeLockNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000,
};

/**
 * Owns the live recording of one run: the GPS watch, the active-time stopwatch
 * (excluding paused spans), and pause/resume/stop. Times are wall-clock ms
 * since the run started, so the server's segment filter (src/lib/run/distance)
 * sees real gaps for pauses. The derived numbers (distance, pace, calories) are
 * computed by the caller from `points` via computeRunSummary — this hook only
 * captures.
 */
export function useRunRecorder(): RunRecorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [points, setPoints] = useState<RunRoutePoint[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const statusRef = useRef<RecorderStatus>("idle");
  const startWallRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const accumulatedRef = useRef(0); // active ms banked before the current span
  const spanStartRef = useRef(0); // epoch ms the current running span began
  const pointsRef = useRef<RunRoutePoint[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const setStatusBoth = useCallback((next: RecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const acquireWakeLock = useCallback(() => {
    const nav = navigator as Navigator & WakeLockNavigator;
    nav.wakeLock
      ?.request("screen")
      .then((lock) => {
        wakeLockRef.current = lock;
      })
      .catch(() => {
        // Unsupported or denied — recording still works, screen may sleep.
      });
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    releaseWakeLock();
  }, [releaseWakeLock]);

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null || !("geolocation" in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (statusRef.current !== "recording") return;
        const point: RunRoutePoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now() - startWallRef.current,
        };
        pointsRef.current = [...pointsRef.current, point];
        setPoints(pointsRef.current);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopTracking();
          setStatusBoth("denied");
        }
      },
      GEO_OPTIONS
    );
  }, [setStatusBoth, stopTracking]);

  const start = useCallback(() => {
    const now = Date.now();
    startWallRef.current = now;
    startedAtRef.current = new Date(now).toISOString();
    accumulatedRef.current = 0;
    spanStartRef.current = now;
    pointsRef.current = [];
    setPoints([]);
    setElapsedMs(0);
    setStatusBoth("recording");
    startWatch();
    acquireWakeLock();
    if (tickRef.current === null) {
      tickRef.current = setInterval(() => {
        if (statusRef.current === "recording") {
          setElapsedMs(accumulatedRef.current + (Date.now() - spanStartRef.current));
        }
      }, 1000);
    }
  }, [acquireWakeLock, setStatusBoth, startWatch]);

  const pause = useCallback(() => {
    if (statusRef.current !== "recording") return;
    accumulatedRef.current += Date.now() - spanStartRef.current;
    setElapsedMs(accumulatedRef.current);
    setStatusBoth("paused");
    releaseWakeLock();
  }, [releaseWakeLock, setStatusBoth]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    spanStartRef.current = Date.now();
    setStatusBoth("recording");
    acquireWakeLock();
  }, [acquireWakeLock, setStatusBoth]);

  const finalize = useCallback((): RunPayload | null => {
    if (statusRef.current === "recording") {
      accumulatedRef.current += Date.now() - spanStartRef.current;
    }
    stopTracking();
    setStatusBoth("saving");
    if (!startedAtRef.current) return null;
    return {
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      points: pointsRef.current,
    };
  }, [setStatusBoth, stopTracking]);

  // Clean up the watch / interval / wake lock if the screen unmounts mid-run.
  useEffect(() => stopTracking, [stopTracking]);

  return { status, points, elapsedMs, start, pause, resume, finalize };
}
