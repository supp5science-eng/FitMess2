"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(app)/actions";
import { createCloneAction } from "@/app/(app)/onboarding/klon/actions";
import { downscaleImage } from "@/lib/image/downscale";
import {
  clearStashedKlon,
  readStashedKlon,
  stashKlon,
} from "@/lib/avatar/klon-stash";
import {
  checkPhotoCount,
  MAX_CLONE_PHOTOS,
  MIN_CLONE_PHOTOS,
} from "@/lib/avatar/clone-prompt";

/**
 * The avatar screen. One component, two places it runs:
 *
 * - `mode="javni"` -- `/klon`, the FIRST screen of the funnel (landing ->
 *   "Kreni" -> here -> `/upitnik`). No account exists, so the drawing is kept
 *   in the visitor's own browser (`@/lib/avatar/klon-stash`) and nothing is
 *   stored server-side. Continues into the questionnaire.
 * - `mode="nalog"` -- `/onboarding/klon`, behind auth. Writes the klon to the
 *   account, and is the MANDATORY gate: no klon, no app. Its first move is to
 *   look for a klon stashed by the public screen, so the common path never asks
 *   for photos a second time.
 *
 * Beyond collecting files the screen has one job: make it obvious, before a
 * single photo is picked, that the photos are not kept.
 *
 * Every file is downscaled in the browser first -- the same `downscaleImage`
 * the meal-photo flow uses, but SMALLER, and the number matters. Twenty
 * originals off a modern phone is an 80MB+ upload; more to the point, the
 * authenticated path goes through a Server Action, and those cap the whole
 * request at 10MB (`next.config.ts`) -- over that the request is rejected
 * BEFORE the action runs, the silent-spinner failure that cap's comment was
 * written about. At 768px twenty photos land around 2-3MB, and the model draws
 * a face from 768px as well as it does from 1280.
 */

/** Long edge, per photo. A request-size budget, not a quality setting. */
const CLONE_MAX_DIM = 768;
const CLONE_QUALITY = 0.8;

type Stage =
  | { kind: "pick" }
  | { kind: "working" }
  /** `saved` means "it is on the account", so it is always false on `/klon`. */
  | { kind: "done"; dataUrl: string; saved: boolean };

type Picked = { id: string; file: File; url: string };

type Result =
  | { ok: true; dataUrl: string; saved: boolean }
  | { ok: false; error_sr: string };

export function KlonScreen({
  mode,
  initialDataUrl,
}: {
  mode: "javni" | "nalog";
  initialDataUrl?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [stage, setStage] = useState<Stage>(
    initialDataUrl
      ? { kind: "done", dataUrl: initialDataUrl, saved: true }
      : { kind: "pick" }
  );

  // On the account screen, before asking for anything: the visitor may already
  // have drawn their klon on `/klon`, before they had an account to put it on.
  // Attaching it here is what makes the pre-auth flow whole -- without this the
  // mandatory gate would ask a user who just waited two minutes to do it again.
  useEffect(() => {
    if (mode !== "nalog" || initialDataUrl) return;
    let cancelled = false;

    readStashedKlon().then(async (blob) => {
      if (cancelled || !blob) return;
      setStage({ kind: "working" });

      const formData = new FormData();
      formData.append("klon", blob, "klon.png");

      try {
        const response = await fetch("/api/klon/sacuvaj", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error(String(response.status));
        // Only now: a stash cleared before the upload lands leaves the user
        // with no klon and no way back to the one they waited for.
        await clearStashedKlon();
        // Hard navigation -- the gate was shut when the router cached /danas.
        window.location.assign("/danas");
      } catch {
        if (cancelled) return;
        // The picture is still stashed, so nothing was lost; fall back to
        // asking for photos rather than stranding them on a spinner.
        setError("Nismo uspeli da sačuvamo klona koga si napravio. Probaj ponovo.");
        setStage({ kind: "pick" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mode, initialDataUrl]);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(undefined);
    setPicked((current) => {
      // Trim to the ceiling rather than rejecting the whole batch: someone who
      // taps "select all" in their gallery meant "use my photos", not "fail".
      const room = MAX_CLONE_PHOTOS - current.length;
      const incoming = Array.from(list)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, Math.max(0, room));
      return [
        ...current,
        ...incoming.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          url: URL.createObjectURL(file),
        })),
      ];
    });
  }

  function remove(id: string) {
    setPicked((current) => {
      const gone = current.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((item) => item.id !== id);
    });
  }

  /** The public screen posts to a route handler; the account screen calls its
   * server action. Same photos, same prompt -- only where the result may be
   * written differs, which is the entire difference between the two modes. */
  async function send(formData: FormData): Promise<Result> {
    if (mode === "nalog") return createCloneAction(formData);

    const response = await fetch("/api/klon", {
      method: "POST",
      body: formData,
    });
    return (await response.json()) as Result;
  }

  async function submit() {
    const verdict = checkPhotoCount(picked.length);
    if (!verdict.ok) {
      setError(verdict.error_sr);
      return;
    }

    setError(undefined);
    setStage({ kind: "working" });

    const formData = new FormData();
    for (const item of picked) {
      const small = await downscaleImage(item.file, CLONE_MAX_DIM, CLONE_QUALITY);
      formData.append("slike", small, "slika.jpg");
    }

    // A rejected request (body over the platform cap, connection dropped mid
    // upload) throws rather than resolving. Without this catch the screen sits
    // on "Crtamo tvog klona..." forever with no way back.
    let result: Result;
    try {
      result = await send(formData);
    } catch (err) {
      console.error("[klon] send failed:", err);
      setError("Slanje nije uspelo. Probaj sa manje slika ili na boljoj vezi.");
      setStage({ kind: "pick" });
      return;
    }

    if (!result.ok) {
      setError(result.error_sr);
      setStage({ kind: "pick" });
      return;
    }

    // Public mode: the server kept nothing, so the browser is the only copy.
    // Stashed BEFORE the screen says "done" -- a visitor who taps Nastavi the
    // instant it appears must not outrun the write.
    if (mode === "javni") {
      try {
        const blob = await (await fetch(result.dataUrl)).blob();
        await stashKlon(blob);
      } catch (err) {
        // Storage blocked (private mode, a locked-down browser). They still see
        // their klon; they will just draw it again after signing up.
        console.error("[klon] stash failed:", err);
      }
    }

    setStage({ kind: "done", dataUrl: result.dataUrl, saved: result.saved });
  }

  if (stage.kind === "done") {
    const canContinue = mode === "javni" || stage.saved;

    return (
      <div className="flex flex-1 flex-col px-5 pb-8">
        <h1 className="pt-8 text-2xl font-semibold tracking-tight text-foreground">
          Evo te.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ovaj lik te predstavlja u aplikaciji. Odeću biraš kasnije.
        </p>

        {/* eslint-disable-next-line @next/next/no-img-element -- a base64 data
            URL, never a remote file: `next/image` would only add a loader in
            front of bytes we already hold. */}
        <img
          src={stage.dataUrl}
          alt="Tvoj klon"
          className="mx-auto mt-6 w-full max-w-[280px] rounded-2xl bg-muted"
        />

        {!canContinue && (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            Nacrtali smo ga, ali nismo uspeli da ga sačuvamo. Probaj ponovo —
            bez sačuvanog klona ne možemo da te pustimo dalje.
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-8">
          {canContinue && (
            <Button
              className="h-14 w-full rounded-full text-base font-semibold"
              onClick={() => {
                // Hard navigation on both paths: the klon gate's answer changed
                // under the App Router's cached copy of the destination.
                window.location.assign(mode === "javni" ? "/upitnik" : "/danas");
              }}
            >
              Nastavi
            </Button>
          )}
          <Button
            variant={canContinue ? "ghost" : "default"}
            className={
              canContinue
                ? "h-11 w-full rounded-full text-sm"
                : "h-14 w-full rounded-full text-base font-semibold"
            }
            onClick={() => {
              setPicked([]);
              setStage({ kind: "pick" });
            }}
          >
            {canContinue ? "Napravi ponovo" : "Probaj ponovo"}
          </Button>
        </div>
      </div>
    );
  }

  const working = stage.kind === "working";
  const enough = picked.length >= MIN_CLONE_PHOTOS;

  return (
    <div className="flex flex-1 flex-col px-5 pb-8">
      <h1 className="pt-8 text-2xl font-semibold tracking-tight text-foreground">
        Napravi svog klona
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ubaci od {MIN_CLONE_PHOTOS} do {MAX_CLONE_PHOTOS} svojih slika — nekoliko
        lica izbliza i nekoliko cele figure. Od njih crtamo lik koji te
        predstavlja.
      </p>
      <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        Slike se ne čuvaju. Koriste se samo da bi se lik nacrtao i brišu se
        odmah — ostaje samo crtež.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          // Clear, so picking the SAME file again still fires `change`.
          event.target.value = "";
        }}
      />

      <div className="mt-5 grid grid-cols-3 gap-2">
        {picked.map((item) => (
          <div key={item.id} className="relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element -- an object
                URL for a file the user just picked; there is nothing for
                `next/image` to optimise. */}
            <img
              src={item.url}
              alt=""
              className="h-full w-full rounded-xl object-cover"
            />
            {!working && (
              <button
                type="button"
                aria-label="Izbaci sliku"
                onClick={() => remove(item.id)}
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-foreground text-xs text-background"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {picked.length < MAX_CLONE_PHOTOS && !working && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border text-2xl text-muted-foreground"
          >
            +
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {picked.length} / {MAX_CLONE_PHOTOS}
        {!enough && ` — još ${MIN_CLONE_PHOTOS - picked.length} do minimuma`}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-8">
        <Button
          className="h-14 w-full rounded-full text-base font-semibold"
          disabled={!enough || working}
          onClick={submit}
        >
          {working ? "Crtamo tvog klona…" : "Napravi klona"}
        </Button>
        {working ? (
          <p className="text-center text-xs text-muted-foreground">
            Ovo traje do dva minuta. Ne zatvaraj ekran.
          </p>
        ) : (
          mode === "nalog" && (
            // The only way off the mandatory screen other than finishing.
            // Deliberately quiet -- an emergency exit, not an offer. Without it
            // "obavezno" would mean an account nobody can get out of when the
            // drawing keeps failing.
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                className="h-11 w-full rounded-full text-xs text-muted-foreground"
              >
                Odjavi se
              </Button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
