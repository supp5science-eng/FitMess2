"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";

import {
  activeLensKey,
  buildLensOptions,
  type LensOption,
} from "@/lib/camera/lenses";

import { useT } from "@/components/i18n/locale-provider";
import type { TFunction } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

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

function messageForCameraError(error: unknown, t: TFunction): string {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return t("media.camera.denied");
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return t("media.camera.noCamera");
  }
  return t("media.camera.generic");
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
  const { t } = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [reason, setReason] = useState<string>(() => t("media.camera.generic"));
  // Lens/zoom stops this phone can actually honour, discovered from the live
  // track (see `buildLensOptions`). Empty on devices that offer no real choice,
  // and then no switcher is rendered at all.
  const [lenses, setLenses] = useState<LensOption[]>([]);
  // `deviceId` needs a fresh stream (the iOS lens-switching path); `zoom` is
  // applied to the running track (the Android path). Only one is ever set.
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
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
          setReason(t("media.camera.noCamera"));
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
          //
          // Once the user picks a lens, `deviceId` takes over -- and THAT one
          // is `exact`, because a lens button that quietly falls back to a
          // different lens is worse than an error we can report.
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          setReason(messageForCameraError(error, t));
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

      // What this phone can offer is only knowable from a LIVE track: the zoom
      // capability comes off the track itself, and `enumerateDevices` only
      // fills in camera labels once permission has been granted -- before that
      // every label is an empty string and nothing can be classified.
      const track = stream.getVideoTracks()[0];
      // `zoom` is real but still outside the standard lib typings (it is the
      // Android/Chromium path; Safari omits it entirely), so it is read through
      // a narrow local shape rather than a lib-wide declaration merge.
      const capabilities = track.getCapabilities?.() as
        | { zoom?: { min: number; max: number } }
        | undefined;
      const zoomRange = capabilities?.zoom ?? null;

      let devices: MediaDeviceInfo[] = [];
      try {
        devices = await mediaDevices.enumerateDevices();
      } catch {
        // Not fatal -- it only costs us the lens switcher.
      }
      if (cancelled) return;

      setLenses(buildLensOptions({ devices, zoom: zoomRange }));
      if (zoomRange) {
        const settings = (
          track as MediaStreamTrack & {
            getSettings?: () => { zoom?: number };
          }
        ).getSettings?.();
        setZoom(settings?.zoom ?? 1);
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
    // `deviceId` restarts the stream on another physical lens; zoom does not
    // (it is applied to the running track).
  }, [stopStream, deviceId, t]);

  async function selectLens(option: LensOption) {
    if (option.deviceId !== undefined) {
      // Restarting the stream is the only way to change physical lens. The
      // effect's cleanup stops the old track first, which matters on iOS: it
      // will not hand out a second camera while one is still open.
      setStatus("starting");
      setDeviceId(option.deviceId);
      return;
    }
    if (option.zoom === undefined) return;

    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: option.zoom }],
      } as unknown as MediaTrackConstraints);
      setZoom(option.zoom);
    } catch {
      // The stop was advertised by the device's own capabilities, so a failure
      // here is unexpected -- but a dead tap beats a broken viewfinder.
    }
  }

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
          setReason(t("media.camera.generic"));
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
          <span className="text-sm">{t("media.camera.opening")}</span>
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
          aria-label={t("media.camera.cancel")}
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

      {/* Lens stops, phone-camera style. Rendered only when the device reports
          stops it can really honour -- see `buildLensOptions`. */}
      {lenses.length > 1 ? (
        <div
          data-testid="camera-lenses"
          role="group"
          aria-label={t("media.camera.lens")}
          className="relative mx-auto mb-4 flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur-sm"
        >
          {lenses.map((option) => {
            const isActive =
              activeLensKey(lenses, { deviceId, zoom }) === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => void selectLens(option)}
                aria-pressed={isActive}
                data-testid={`camera-lens-${option.label}`}
                className={cn(
                  "flex size-11 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-white text-black"
                    : "text-white/85 hover:bg-white/15"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Bottom bar: shutter in the middle, library on the side. */}
      <div className="relative flex items-center justify-between px-8 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        {onPickFromLibrary ? (
          <button
            type="button"
            onClick={onPickFromLibrary}
            aria-label={t("media.camera.uploadExisting")}
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
          aria-label={t("media.camera.takePhoto")}
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
