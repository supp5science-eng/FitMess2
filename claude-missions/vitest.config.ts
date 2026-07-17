import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // F016: live integration test files (F010's profiles-rls, F015's
    // onboarding-route, F016's actions.integration) each create test users
    // and sign in against the same real Supabase project's Auth API.
    // Vitest's default file parallelism ran these concurrently, and their
    // combined burst of admin.createUser/signInWithPassword calls started
    // tripping Supabase's shared short-window Auth rate limit
    // (`over_request_rate_limit`, 429) once a third live-auth file (this
    // feature's) was added -- each file passes reliably in isolation (see
    // the F016 handoff), only concurrent runs collided. Serializing file
    // execution removes the collision without weakening any test; the
    // suite runs a little slower but stays deterministic against a shared
    // live external service, which matters more for a suite every worker
    // re-runs before every commit.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
