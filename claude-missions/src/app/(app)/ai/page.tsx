import type { Metadata } from "next";

import { AgentScreen } from "@/components/ai/agent-screen";

/**
 * `/ai` — the AI tab (2026-08-25): nothing but the FitMess agent.
 *
 * The screen itself is the client `AgentScreen` (the orb, the thread, the
 * input); this server wrapper only exists to own the route and its title.
 * The route lives in the `(app)` group, so the middleware's default-deny
 * protection applies (signed-in, verified, onboarded), and the app shell
 * keeps the bottom navigation under it.
 */
export const metadata: Metadata = {
  title: "AI",
};

export default function AiPage() {
  return <AgentScreen />;
}
