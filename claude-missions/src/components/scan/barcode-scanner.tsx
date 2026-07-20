"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CameraOff, RefreshCw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { decodeBarcode } from "@/lib/scan/barcode-detector";

// F030 / AS-052, AS-058: the reusable, camera-driving barcode scanner
// screen. Opens the device camera via `getUserMedia` and repeatedly feeds
// the live `<video>` element to the entirely-client-side decoder in
// `@/lib/scan/barcode-detector` (AS-052) -- no image or frame ever leaves
// the device. On a successful decode it calls `onDetected(gtin)` and stops
// the camera; it does NOT itself navigate or look anything up -- that's
// F031's job (see this feature's handoff for exactly how F031 should
// consume the emitted GTIN).
//
// AS-058: if the camera permission is denied, or no camera exists, or the
// browser has no camera API at all, this renders a friendly Serbian
// message plus a real link to manual search (`/dodaj/pretraga`) -- never a
// blank or broken screen.

const SCAN_INTERVAL_MS = 350;

const DENIED_MESSAGE_SR =
  "Nemamo pristup kameri. Dozvoli pristup kameri u podešavanjima pregledača, ili pretraži ručno.";
const NO_CAMERA_MESSAGE_SR =
  "Nije pronađena kamera na ovom uređaju. Pretraži ručno.";
const GENERIC_UNAVAILABLE_MESSAGE_SR =
  "Skener trenutno ne radi na ovom uređaju. Pretraži ručno.";
const DECODE_ERROR_MESSAGE_SR = "Skeniranje trenutno ne radi. Pokušaj ponovo.";

const DEFAULT_TITLE_SR = "Skeniraj barkod";
const DEFAULT_SUBTITLE_SR = "Uperi kameru u barkod proizvoda.";
const UPLOAD_NOT_FOUND_MESSAGE_SR =
  "Nismo našli barkod na slici. Slikaj izbliza, ravno, dobro osvetljeno — pa pokušaj ponovo.";
const UPLOAD_FAILED_MESSAGE_SR =
  "Nismo uspeli da očitamo sliku. Pokušaj ponovo.";

type ScanStatus = "requesting" | "scanning" | "denied" | "error";

function messageForCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : undefined;
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return DENIED_MESSAGE_SR;
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError"
  ) {
    return NO_CAMERA_MESSAGE_SR;
  }
  return GENERIC_UNAVAILABLE_MESSAGE_SR;
}

export interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  /** Optional heading/subheading overrides -- default to the "Skeniraj
   * barkod" logging copy. The "Dodaj proizvod" flow passes its own so the
   * same scanner reads as "add a product" there. */
  title?: string;
  subtitle?: string;
}

export function BarcodeScanner({
  onDetected,
  title = DEFAULT_TITLE_SR,
  subtitle = DEFAULT_SUBTITLE_SR,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<ScanStatus>("requesting");
  const [statusMessage, setStatusMessage] = useState(
    GENERIC_UNAVAILABLE_MESSAGE_SR
  );
  const [attempt, setAttempt] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    async function start() {
      setStatus("requesting");

      const mediaDevices =
        typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;

      if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
        if (!cancelled) {
          setStatusMessage(NO_CAMERA_MESSAGE_SR);
          setStatus("denied");
        }
        return;
      }

      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(messageForCameraError(error));
          setStatus("denied");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (cancelled) {
        stopStream();
        return;
      }

      // F031 fix: the real `<video>` element (and `videoRef`) only exists
      // in the JSX branch rendered once `status === "scanning"` -- at THIS
      // point in the effect, status is still "requesting", so
      // `videoRef.current` is unavoidably `null` here (nothing has
      // rendered a `<video>` yet). Attaching `stream` to the video element
      // is handled by the separate effect below, which runs AFTER this
      // `setStatus("scanning")` re-render actually mounts the `<video>`
      // node -- attempting `videoRef.current.srcObject = stream` at this
      // line (as a previous version of this file did) silently no-ops
      // forever, since the guard `if (video)` is always false here: the
      // camera permission prompt succeeds, but no frame is ever decoded
      // because no frame is ever attached.
      setStatus("scanning");

      intervalRef.current = setInterval(() => {
        const video = videoRef.current;
        if (stoppedRef.current || !video) return;
        decodeBarcode(video)
          .then((result) => {
            if (!result || stoppedRef.current) return;
            stoppedRef.current = true;
            stopStream();
            onDetected(result.value);
          })
          .catch((error) => {
            if (stoppedRef.current) return;
            // The video element can briefly have no decodable frame yet
            // (right after the stream attaches, before its first real
            // frame paints) -- the decoder reports that as
            // `InvalidStateError`, which is not a real decode failure, just
            // "nothing to read yet." Skip this tick silently and let the
            // next one (~350ms later) retry against a real frame, instead
            // of surfacing a scary error for a normal startup race.
            if (error instanceof DOMException && error.name === "InvalidStateError") {
              return;
            }
            stoppedRef.current = true;
            stopStream();
            console.error("[F030 BarcodeScanner] decodeBarcode failed:", error);
            if (!cancelled) {
              setStatusMessage(DECODE_ERROR_MESSAGE_SR);
              setStatus("error");
            }
          });
      }, SCAN_INTERVAL_MS);
    }

    start();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      stopStream();
    };
  }, [attempt, onDetected, stopStream]);

  // F031 fix (see the long comment above `setStatus("scanning")`): attaches
  // the already-granted camera `stream` to the `<video>` element ONCE that
  // element actually exists in the DOM -- i.e. once `status === "scanning"`
  // triggers the real-scanner JSX below to render and `videoRef` to attach.
  // Without this, the video (and therefore every `decodeBarcode(video)`
  // call in the polling loop above) never receives a single real frame:
  // `getUserMedia` succeeds, the UI shows the live-looking viewfinder, but
  // no barcode is EVER decoded -- confirmed by a real headless-browser
  // walkthrough (`video.videoWidth`/`readyState` stuck at 0 indefinitely)
  // while building F031's own scan -> lookup -> log evidence.
  useEffect(() => {
    if (status !== "scanning") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    // `video.play()` returns `undefined` rather than a real `Promise` in
    // some test/DOM environments (e.g. jsdom, which has no native media
    // pipeline) -- guard before `.catch`-ing it, same defensive shape as
    // every other optional-chaining call in this file.
    video.play()?.catch(() => {
      // Autoplay can reject in some browsers until a user gesture; the
      // stream is already attached and will render once playback resumes
      // -- not a failure state worth surfacing.
    });
  }, [status]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  // AS-052 stays true for uploads too: `decodeBarcode` runs the SAME
  // entirely-client-side WASM decoder against the chosen image `File` (a
  // `Blob`, a valid decode source) -- the picked photo never leaves the
  // device. On a hit we stop the live camera (if running) and emit the GTIN
  // exactly like a live scan; a miss is a friendly "no barcode found here,"
  // never a crash or a silent no-op.
  async function handleUpload(file: File) {
    setUploadMessage(null);
    setUploadBusy(true);
    try {
      const result = await decodeBarcode(file);
      if (!result) {
        setUploadMessage(UPLOAD_NOT_FOUND_MESSAGE_SR);
        setUploadBusy(false);
        return;
      }
      stoppedRef.current = true;
      stopStream();
      onDetected(result.value);
    } catch (error) {
      console.error("[F030 BarcodeScanner] upload decode failed:", error);
      setUploadMessage(UPLOAD_FAILED_MESSAGE_SR);
      setUploadBusy(false);
    }
  }

  function renderUpload() {
    return (
      <div className="flex flex-col items-center gap-2">
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          data-testid="scanner-upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleUpload(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploadBusy}
          onClick={() => uploadInputRef.current?.click()}
          data-testid="scanner-upload-button"
        >
          <Upload aria-hidden="true" />
          {uploadBusy ? "Očitavam sliku…" : "Otpremi sliku barkoda"}
        </Button>
        {uploadMessage ? (
          <p
            role="alert"
            data-testid="scanner-upload-message"
            className="text-center text-sm font-medium text-destructive"
          >
            {uploadMessage}
          </p>
        ) : null}
      </div>
    );
  }

  if (status === "requesting") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-loading"
        aria-busy="true"
      >
        <Skeleton className="h-64 w-full max-w-xs rounded-2xl" />
        <p className="text-sm text-muted-foreground">
          Tražimo pristup kameri...
        </p>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-permission-denied"
      >
        <CameraOff
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p role="alert" data-testid="scanner-denied-message" className="text-sm text-foreground">
          {statusMessage}
        </p>
        {renderUpload()}
        <Link
          href="/dodaj/pretraga"
          data-testid="scanner-manual-search-link"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Pretraži ručno
        </Link>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center"
        data-testid="scanner-error-state"
      >
        <p
          role="alert"
          data-testid="scanner-error"
          className="text-sm font-medium text-destructive"
        >
          {statusMessage}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={retry}
          data-testid="scanner-retry-button"
        >
          <RefreshCw aria-hidden="true" />
          Pokušaj ponovo
        </Button>
        {renderUpload()}
        <Link
          href="/dodaj/pretraga"
          data-testid="scanner-manual-search-link"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Ili pretraži ručno
        </Link>
      </main>
    );
  }

  return (
    <main
      className="flex flex-1 flex-col gap-4 px-6 py-8"
      data-testid="scanner-screen"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="relative aspect-3/4 w-full overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          data-testid="scanner-video"
          className="size-full object-cover"
          playsInline
          muted
          autoPlay
          aria-label="Prikaz kamere za skeniranje barkoda"
        />
        <div
          data-testid="scanner-viewfinder"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        />
      </div>
      {renderUpload()}

      <Link
        href="/dodaj/pretraga"
        data-testid="scanner-manual-search-link"
        className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        Ne vidiš barkod? Pretraži ručno.
      </Link>
    </main>
  );
}
