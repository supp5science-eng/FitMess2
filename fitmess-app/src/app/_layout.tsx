import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/theme/tokens";

/**
 * The root of the native app.
 *
 * The whole reason FitMess is being rebuilt: from here down there is no web
 * view, no `server.url`, and nothing waiting on the network before the first
 * screen. The JavaScript is inside the binary, so the first frame is drawn
 * from local code — which is what "sporo paljenje" was really about.
 */

// Hold the native splash until we know whether this user is signed in. This is
// the native equivalent of the site's middleware running before the first
// paint: without it the app shows one frame of the sign-in screen to a user
// who is already signed in, on every cold start.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { session, restoring } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (restoring) return;

    // The splash comes down only once the routing decision below has been
    // made, so the user never sees the wrong side of the gate.
    void SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/prijava");
    } else if (session && inAuthGroup) {
      router.replace("/(app)");
    }
  }, [session, restoring, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // The native stack, not a JS-drawn imitation: the push animation, the
        // interactive swipe-back and the way a gesture can be abandoned
        // half-way all come from UIKit and Android's own transitions. This is
        // the line that answers "navigacija se oseća kao web".
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
