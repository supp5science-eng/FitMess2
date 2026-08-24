"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createCloneAction } from "@/app/(app)/onboarding/klon/actions";
import { signOutAction } from "@/app/(app)/actions";
import { downscaleImage } from "@/lib/image/downscale";
import {
  checkPhotoCount,
  MAX_CLONE_PHOTOS,
  MIN_CLONE_PHOTOS,
} from "@/lib/avatar/clone-prompt";

/**
 * `/onboarding/klon` -- pick 5-20 photos, get your klon.
 *
 * MANDATORY (product decision, 2026-08-24): there is no "Preskoči". The
 * middleware keeps an onboarded user without a klon on this route and nowhere
 * else (`@/lib/auth/route-protection`), so the only ways off this screen are a
 * finished klon and the sign-out below. The sign-out is not a loophole -- it is
 * the difference between a mandatory step and an account nobody can get out of
 * when the drawing keeps failing.
 *
 * Beyond collecting files the screen has one job: make it obvious, before a
 * single photo is picked, that the photos are not kept. That sentence is not
 * fine print here, it is the reason someone hands over twenty pictures of their
 * own face to an app they installed ten minutes ago.
 *
 * Every file is downscaled in the browser before it is sent -- the same
 * `downscaleImage` the meal-photo flow uses, but SMALLER than that flow asks
 * for, and the number matters. Twenty originals off a modern phone is an 80 MB+
 * upload; more to the point, Server Actions cap the whole request at 10 MB
 * (`next.config.ts`), and a request over that is rejected BEFORE the action
 * runs -- the exact silent-spinner failure that cap's comment was written
 * about. At 768px a batch of twenty lands around 2-3 MB, well inside it, and
 * the model draws a face from 768px as well as it does from 1280.
 */

/** Long edge, per photo. See the note above -- this is a request-size budget,
 * not a quality setting. */
const CLONE_MAX_DIM = 768;
const CLONE_QUALITY = 0.8;

type Stage =
  | { kind: "pick" }
  | { kind: "working" }
  | { kind: "done"; dataUrl: string; saved: boolean };

type Picked = { id: string; file: File; url: string };

export function KlonScreen({ initialDataUrl }: { initialDataUrl?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [stage, setStage] = useState<Stage>(
    initialDataUrl
      ? { kind: "done", dataUrl: initialDataUrl, saved: true }
      : { kind: "pick" }
  );

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

    // A rejected action (body over the platform cap, connection dropped mid
    // upload) throws rather than resolving. Without this catch the screen sits
    // on "Crtamo tvog klona..." forever with no way back.
    let result;
    try {
      result = await createCloneAction(formData);
    } catch (err) {
      console.error("[klon] action failed:", err);
      setError("Slanje nije uspelo. Probaj sa manje slika ili na boljoj vezi.");
      setStage({ kind: "pick" });
      return;
    }

    if (!result.ok) {
      setError(result.error_sr);
      setStage({ kind: "pick" });
      return;
    }
    setStage({ kind: "done", dataUrl: result.dataUrl, saved: result.saved });
  }

  if (stage.kind === "done") {
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

        {!stage.saved && (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            Nacrtali smo ga, ali nismo uspeli da ga sačuvamo. Probaj ponovo —
            bez sačuvanog klona ne možemo da te pustimo dalje.
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-8">
          {/* Only when the klon is really stored: `profiles.klon_at` is what the
              middleware checks, so offering "Nastavi" on an unsaved klon would
              send the user into a redirect that bounces straight back here. */}
          {stage.saved && (
            <Button
              className="h-14 w-full rounded-full text-base font-semibold"
              onClick={() => {
                // Hard navigation: the klon gate was open when the App Router
                // cached /danas as a redirect back to this screen.
                window.location.assign("/danas");
              }}
            >
              Nastavi
            </Button>
          )}
          <Button
            variant={stage.saved ? "ghost" : "default"}
            className={
              stage.saved
                ? "h-11 w-full rounded-full text-sm"
                : "h-14 w-full rounded-full text-base font-semibold"
            }
            onClick={() => {
              setPicked([]);
              setStage({ kind: "pick" });
            }}
          >
            {stage.saved ? "Napravi ponovo" : "Probaj ponovo"}
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
          // The only way off this screen other than finishing. Deliberately
          // quiet -- it is an emergency exit, not an offer.
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="h-11 w-full rounded-full text-xs text-muted-foreground"
            >
              Odjavi se
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
