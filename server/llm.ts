/**
 * LLM provider — configurable across OpenAI, Anthropic, and Google Gemini.
 *
 * Provider selection (in order of priority):
 *   1. LLM_PROVIDER env var ("openai" | "anthropic" | "gemini")
 *   2. Auto-detect based on available API keys:
 *      - OPENAI_API_KEY → OpenAI
 *      - ANTHROPIC_API_KEY / ANTHROPIC_KEY → Anthropic
 *      - GEMINI_API_KEY → Gemini
 *
 * All LLM calls in the application go through this module.
 *
 * Usage:
 *   const result = await llm.generate({ system, messages, maxTokens, temperature });
 *   const stream = llm.stream({ system, messages, maxTokens });
 */

import OpenAI from "openai";
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
// Provider detection
// ---------------------------------------------------------------------------

type Provider = "openai" | "anthropic" | "gemini";

function detectProvider(): Provider {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "openai" || forced === "anthropic" || forced === "gemini") {
    return forced;
  }

  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";

  throw new Error(
    "No LLM API key configured. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
  );
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

let _openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openaiClient) return _openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured. Set OPENAI_API_KEY.");
  }

  _openaiClient = new OpenAI({ apiKey });
  return _openaiClient;
}

const OPENAI_MODEL = "gpt-4o";

async function openaiGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
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
    model: OPENAI_MODEL,
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
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------

let _anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (_anthropicClient) return _anthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY.");
  }

  _anthropicClient = new Anthropic({ apiKey });
  return _anthropicClient;
}

const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";

async function anthropicGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
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
    model: ANTHROPIC_MODEL,
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
// Gemini client (via OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------

let _geminiClient: OpenAI | null = null;

function getGemini(): OpenAI {
  if (_geminiClient) return _geminiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY.");
  }

  _geminiClient = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  return _geminiClient;
}

const GEMINI_MODEL = "gemini-2.0-flash";

async function geminiGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getGemini();

  const response = await client.chat.completions.create({
    model: GEMINI_MODEL,
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

async function* geminiStream(
  req: LLMRequest
): AsyncGenerator<string, void, unknown> {
  const client = getGemini();

  const stream = await client.chat.completions.create({
    model: GEMINI_MODEL,
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
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

// ---------------------------------------------------------------------------
// Provider dispatch
// ---------------------------------------------------------------------------

function getGenerateFn(
  provider: Provider
): (req: LLMRequest) => Promise<LLMResponse> {
  switch (provider) {
    case "openai":
      return openaiGenerate;
    case "anthropic":
      return anthropicGenerate;
    case "gemini":
      return geminiGenerate;
  }
}

function getStreamFn(
  provider: Provider
): (req: LLMRequest) => AsyncGenerator<string, void, unknown> {
  switch (provider) {
    case "openai":
      return openaiStream;
    case "anthropic":
      return anthropicStream;
    case "gemini":
      return geminiStream;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const activeProvider = detectProvider();
console.log(`[llm] Using provider: ${activeProvider}`);

export const llm = {
  /** Non-streaming generation */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    return getGenerateFn(activeProvider)(req);
  },

  /** Streaming generation — yields text chunks */
  stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
    return getStreamFn(activeProvider)(req);
  },

  /** Currently active provider name */
  provider: activeProvider,
};
