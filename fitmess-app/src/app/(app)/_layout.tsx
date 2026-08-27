import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

// Tools and screen components register themselves on import. Done here, at the
// root of the signed-in app, so every screen below can rely on the registry
// being populated — and so it happens exactly once.
import "@/jarvis/registracija";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
