import Anthropic from "@anthropic-ai/sdk";

import type { ChatTurn } from "@/lib/ai/gemini";

/**
 * Prizma's brain on Claude (2026-08-25, dogovor iz dnevnika): the agent chat
 * moves to `claude-opus-5` because Gemini's chat replies read dumb next to its
 * perfectly good vision estimates. Gemini keeps every other surface — images,
 * labels, STT — this module exists ONLY for the agent turn.
 *
 * NEVER import this from a client component — it reads `ANTHROPIC_API_KEY`.
 */

const CLAUDE_AGENT_MODEL = "claude-opus-5";

/** Whether the route may pick the Claude brain at all. The key is optional on
 * purpose: production deploys before the key exists fall back to Gemini and
 * the AI tab keeps working. */
export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  // Lazy, so merely importing the module (route bundling, tests) never throws
  // on a missing key — only an actual turn does.
  if (!client) client = new Anthropic();
  return client;
}

/**
 * One Prizma agent turn on Claude: same contract as Gemini's
 * `generateAgentTurn` — system prompt + running conversation in, a JSON string
 * out — so the route swaps brains without touching the parse.
 *
 * `output_config.format` guarantees the reply is valid JSON matching the
 * schema; `agentModelReplySchema` in the route stays the contract (and still
 * drops hallucinated action ids without failing the turn).
 */
export async function generateAgentTurnClaude(
  systemPrompt: string,
  turns: ChatTurn[],
  responseSchema: Record<string, unknown>
): Promise<string> {
  const response = await getClient().messages.create({
    model: CLAUDE_AGENT_MODEL,
    // Adaptive thinking is on by default and bills into max_tokens, so the
    // cap leaves headroom above the 2-5 sentence reply.
    max_tokens: 4096,
    system: systemPrompt,
    messages: turns.map((turn) => ({
      role: turn.role === "model" ? ("assistant" as const) : ("user" as const),
      content: turn.text,
    })),
    output_config: {
      // "medium": the numbers are settled before the call (same stance as the
      // Gemini config) but the wording and action choice deserve some thought.
      // Tune by ear against latency once the live test runs.
      effort: "medium",
      format: {
        type: "json_schema",
        schema: responseSchema,
      },
    },
  });

  if (response.stop_reason === "refusal") {
    // Safety classifier declined (HTTP 200, no content). Surface as an error
    // so the route answers with its calm Serbian fallback copy.
    throw new Error("Claude declined the request (stop_reason: refusal)");
  }

  const text = response.content.find(
    (block): block is Extract<typeof block, { type: "text" }> =>
      block.type === "text"
  )?.text;
  if (!text) {
    throw new Error("Claude returned no text block for the agent turn");
  }
  return text;
}
