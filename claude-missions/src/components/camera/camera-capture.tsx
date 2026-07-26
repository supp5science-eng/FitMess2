"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";

/**
 * A live, in-app camera viewfinder with a shutter button.
 *
 * Why this exists instead of `<input type="file" capture="environment">`:
 * that input hands the user off to the phone's own camera app, and a browser
 * will only open it from a real tap -- which is exactly why the photo flows
 * used to land on a "Otvori kameru / Otpremi sliku" chooser screen first. The
 * chooser was never a feature; it was the tap the browser demanded.
 *
 * `getUserMedia` has no such rule: it can be called on mount, the permission is
 * asked ONCE per install and remembered by the browser from then on, and the
 * camera then opens straight into the app. So the whole intermediate screen
 * disappears and "Slikaj obrok" means what it says.
 *
 * The old path is not gone, it is the fallback: when the camera is denied,
 * missing, or unsupported (older browser, insecure context), `fallback` is
 * rendered instead -- callers pass their existing chooser UI, so no device can
 * end up with no way to log a meal.
 *
 * The stream is stopped on unmount, which is what turns the phone's camera
 * indicator back off; callers get this for free by unmounting the component
 * after a capture.
 */

/** Longest edge we keep from the sensor frame. Estimation downscales further
 * (1568px) on its way to the model -- this only stops a 4K frame from being
 * decoded into memory on a mid-range phone for no gain. */
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.92;

const DENIED_SR =
  "Nema pristupa kameri. Dozvoli kameru u podešavanjima pregledača, ili otpremi postojeću sliku.";
const NO_CAMERA_SR =
  "Ne vidimo kameru na ovom uređaju. Otpremi postojeću sliku.";
const GENERIC_SR =
  "Kamera trenutno nije dostupna. Otpremi postojeću sliku.";

function messageForCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return DENIED_SR;
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return NO_CAMERA_SR;
  }
  return GENERIC_SR;
}

type Status = "starting" | "live" | "unavailable";

export interface CameraCaptureProps {
  /** Receives the captured frame as a JPEG File, ready for the same pipeline
   * a picked file goes through. */
  onCapture: (file: File) => void;
  /** Back out of the camera entirely. */
  onCancel: () => void;
  /** Open the photo library instead (the caller owns the file input). */
  onPickFromLibrary?: () => void;
  /** Short line over the viewfinder telling the user what to frame. */
  hint?: string;
  /** Something that went wrong with the LAST shot (a failed estimate, say),
   * shown over the viewfinder. It belongs here rather than on the page behind:
   * the viewfinder covers the screen, so an error rendered underneath it would
   * be invisible exactly when it matters, and the user would be left staring
   * at a camera wondering why nothing happened. */
  notice?: string | null;
  /** Rendered in place of the viewfinder when the camera can't be used --
   * pass the caller's existing "take a photo / upload" chooser so a denied
   * permission is a detour, not a dead end. The message explaining WHY is
   * passed back so the caller can show it above their own UI. */
  fallback: (reason: string) => React.ReactNode;
}

export function CameraCapture({
  onCapture,
  onCancel,
  onPickFromLibrary,
  hint,
  notice,
  fallback,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [reason, setReason] = useState<string>(GENERIC_SR);
  // Brief white wash on the shutter, so a tap reads as "photo taken" even
  // before the next screen renders.
  const [flashing, setFlashing] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const mediaDevices =
        typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        if (!cancelled) {
          setReason(NO_CAMERA_SR);
          setStatus("unavailable");
        }
        return;
      }

      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({
          // The rear camera, at a resolution good enough to read a plate.
          // `ideal` (not `exact`) so a device that can't honour it still gives
          // us a stream rather than throwing OverconstrainedError.
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          setReason(messageForCameraError(error));
          setStatus("unavailable");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      // The <video> element is rendered unconditionally (not behind a status
      // branch), so it already exists here and the stream can attach straight
      // away -- the barcode scanner had to split this across two effects
      // precisely because its <video> only mounted after the status flipped.
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("live");
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setFlashing(true);
    try {
      navigator.vibrate?.(12);
    } catch {
      // Haptics are a nicety; never let them break the shot.
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setFlashing(false);
          setReason(GENERIC_SR);
          setStatus("unavailable");
          return;
        }
        // Freeing the camera here (rather than waiting for unmount) turns the
        // recording indicator off the instant the shot is taken.
        stopStream();
        onCapture(new File([blob], "obrok.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  }

  if (status === "unavailable") return <>{fallback(reason)}</>;

  return (
    <div
      data-testid="camera-capture"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        // `playsInline` matters on iOS: without it the stream is taken over by
        // the system fullscreen player and the shutter is unreachable.
        className="absolute inset-0 size-full object-cover"
      />

      {status === "starting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
          <Loader2 className="size-7 animate-spin" aria-hidden="true" />
          <span className="text-sm">Otvaram kameru…</span>
        </div>
      ) : null}

      {flashing ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-white"
        />
      ) : null}

      {/* Top bar: a way out, always. */}
      <div className="relative flex items-start justify-between p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Otkaži"
          className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
        >
          <X className="size-6" aria-hidden="true" />
        </button>

        {notice ? (
          <p
            role="alert"
            data-testid="camera-notice"
            className="ml-3 flex-1 rounded-2xl bg-destructive/85 px-4 py-2.5 text-sm text-white backdrop-blur-sm"
          >
            {notice}
          </p>
        ) : null}
      </div>

      <div className="flex-1" />

      {hint && status === "live" ? (
        <p className="relative mx-auto mb-5 max-w-[22rem] rounded-full bg-black/45 px-4 py-2 text-center text-sm text-white/90 backdrop-blur-sm">
          {hint}
        </p>
      ) : null}

      {/* Bottom bar: shutter in the middle, library on the side. */}
      <div className="relative flex items-center justify-between px-8 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        {onPickFromLibrary ? (
          <button
            type="button"
            onClick={onPickFromLibrary}
            aria-label="Otpremi postojeću sliku"
            className="flex size-12 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm"
          >
            <ImageUp className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-12" />
        )}

        <button
          type="button"
          onClick={capture}
          disabled={status !== "live"}
          data-testid="camera-shutter"
          aria-label="Slikaj"
          className="flex size-[74px] items-center justify-center rounded-full border-[5px] border-white/85 bg-white/25 transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className="size-[54px] rounded-full bg-white" />
        </button>

        {/* Balances the row so the shutter sits dead centre. */}
        <span className="size-12" />
      </div>
    </div>
  );
}
