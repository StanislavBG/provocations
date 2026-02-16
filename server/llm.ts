/**
 * LLM provider abstraction — OpenAI via Replit AI Integrations.
 *
 * Uses Replit's built-in environment variables:
 *   - AI_INTEGRATIONS_OPENAI_API_KEY
 *   - AI_INTEGRATIONS_OPENAI_BASE_URL
 *
 * No API key needed on your end — usage is billed to your Replit credits.
 *
 * Usage:
 *   const result = await llm.generate({ system, messages, maxTokens, temperature });
 *   const stream = llm.stream({ system, messages, maxTokens });
 */

import OpenAI from "openai";

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
// OpenAI client (Replit AI Integrations)
// ---------------------------------------------------------------------------

let _openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openaiClient) return _openaiClient;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey || !baseURL) {
    throw new Error(
      "OpenAI AI Integration not configured. " +
      "Ensure AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL are set " +
      "(these are provided automatically by Replit AI Integrations)."
    );
  }

  _openaiClient = new OpenAI({ apiKey, baseURL });
  return _openaiClient;
}

const MODEL = "gpt-4o";

// ---------------------------------------------------------------------------
// OpenAI implementation
// ---------------------------------------------------------------------------

async function openaiGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    messages: [
      { role: "system", content: req.system },
      ...req.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  return { text };
}

async function* openaiStream(
  req: LLMRequest
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAI();

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    stream: true,
    messages: [
      { role: "system", content: req.system },
      ...req.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const llm = {
  /** Non-streaming generation */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    return openaiGenerate(req);
  },

  /** Streaming generation — yields text chunks */
  stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
    return openaiStream(req);
  },
};
