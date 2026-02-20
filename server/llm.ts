/**
 * LLM provider — Anthropic Claude (exclusive).
 *
 * Uses environment variables (both set for redundancy):
 *   - ANTHROPIC_API_KEY
 *   - ANTHROPIC_KEY
 *
 * All LLM calls in the application go through this module.
 *
 * Usage:
 *   const result = await llm.generate({ system, messages, maxTokens, temperature });
 *   const stream = llm.stream({ system, messages, maxTokens });
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface LLMResponse {
  text: string;
}

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

let _anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (_anthropicClient) return _anthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;

  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. " +
      "Set ANTHROPIC_API_KEY (or ANTHROPIC_KEY) in your Replit secrets."
    );
  }

  _anthropicClient = new Anthropic({ apiKey });
  return _anthropicClient;
}

const MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// Anthropic implementation
// ---------------------------------------------------------------------------

async function anthropicGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text };
}

async function* anthropicStream(
  req: LLMRequest
): AsyncGenerator<string, void, unknown> {
  const client = getAnthropic();

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const llm = {
  /** Non-streaming generation */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    return anthropicGenerate(req);
  },

  /** Streaming generation — yields text chunks */
  stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
    return anthropicStream(req);
  },
};
