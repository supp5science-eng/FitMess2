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
    // F031a: vitest's defaults (testTimeout 5000ms, hookTimeout 10000ms)
    // are tight for `*.integration.test.ts` files, which make real network
    // calls to the live Supabase project. Under normal single-instance
    // conditions these defaults are fine, but when this project's shared
    // Supabase instance is under extra load (e.g. another worker/process
    // running its own live-integration suite concurrently), individual
    // calls occasionally exceed 5s, failing an otherwise-correct test with
    // `Test timed out in 5000ms` rather than a real assertion failure.
    // Raising both ceilings gives real network round trips headroom without
    // masking a genuine hang (still a hard, bounded cap, not unlimited) and
    // without slowing down the many fast unit/component tests, which
    // finish in milliseconds regardless of the ceiling.
    testTimeout: 15000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
