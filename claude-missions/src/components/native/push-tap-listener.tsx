"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { listenForNativePushTaps } from "@/lib/push/native";

/**
 * Invisible, app-wide handler for "user tapped a notification".
 *
 * Lives in the shell rather than on the Podsetnici screen because of when it
 * has to be listening: a tap on a reminder usually arrives at a phone whose
 * app is closed, and the shell is what mounts on the way back in. A listener
 * attached only on `/profil/podsetnici` would be armed exactly on the one
 * screen the user is not on.
 *
 * On the web this is the service worker's `notificationclick`; inside the
 * store shell nothing plays that role, so a tap would just restore whatever
 * screen the app was last on — and a reminder about an unlogged lunch that
 * drops you on Podešavanja is a nudge with no follow-through.
 *
 * Renders nothing, and does nothing at all in a browser.
 */
export function PushTapListener() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let handle: { remove(): Promise<void> } | null = null;

    void listenForNativePushTaps((url) => {
      router.push(url);
    }).then((registered) => {
      // The await can land after unmount (a fast route change on a cold
      // start); without this the handle is dropped on the floor and the
      // listener outlives the component that owns it.
      if (cancelled) {
        void registered?.remove().catch(() => undefined);
        return;
      }
      handle = registered;
    });

    return () => {
      cancelled = true;
      void handle?.remove().catch(() => undefined);
    };
  }, [router]);

  return null;
}
