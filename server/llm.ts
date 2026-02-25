/**
 * LLM provider — configurable across OpenAI, Anthropic, and Google Gemini.
 *
 * Provider selection (in order of priority):
 *   1. LLM_PROVIDER env var ("openai" | "anthropic" | "gemini")
 *   2. Auto-detect based on available API keys:
 *      - AI_INTEGRATIONS_OPENAI_API_KEY (Replit) → OpenAI
 *      - ANTHROPIC_API_KEY / ANTHROPIC_KEY → Anthropic
 *      - GEMINI_API_KEY → Gemini
 *
 * All LLM calls in the application go through this module.
 *
 * Usage:
 *   const result = await llm.generate({ system, messages, maxTokens, temperature });
 *   const stream = llm.stream({ system, messages, maxTokens });
 *   // Per-model (for chat model selector):
 *   const result = await llm.generateWithModel("gemini-2.5-pro", req);
 *   const stream = llm.streamWithModel("gpt-4o-mini", req);
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
// Chat model catalog (for per-request model selection in Chat-to-Context)
// ---------------------------------------------------------------------------

type Provider = "openai" | "anthropic" | "gemini";

export interface ChatModelDef {
  id: string;
  label: string;
  provider: Provider;
  tier: "premium" | "value";
}

export const CHAT_MODELS: ChatModelDef[] = [
  // ── Google  ($0.10–$2.00 / $0.40–$12.00 per 1M tokens) ──
  { id: "gemini-2.5-pro",          label: "Gemini 2.5 Pro",          provider: "gemini",    tier: "premium" },  // $1.25 / $10.00
  { id: "gemini-2.5-flash",        label: "Gemini 2.5 Flash",        provider: "gemini",    tier: "value"   },  // $0.30 / $2.50  — best price-performance
  { id: "gemini-2.5-flash-lite",   label: "Gemini 2.5 Flash Lite",   provider: "gemini",    tier: "value"   },  // $0.10 / $0.40  — cheapest
  // ── OpenAI  ($0.15–$2.50 / $0.60–$10.00 per 1M tokens) ──
  { id: "gpt-4o",                  label: "GPT-4o",                  provider: "openai",    tier: "premium" },  // $2.50 / $10.00
  { id: "o4-mini",                 label: "o4 Mini",                 provider: "openai",    tier: "value"   },  // $1.10 / $4.40  — fast reasoning
  { id: "gpt-4o-mini",             label: "GPT-4o Mini",             provider: "openai",    tier: "value"   },  // $0.15 / $0.60  — cheapest
  // ── Anthropic  ($1.00–$3.00 / $5.00–$15.00 per 1M tokens) ──
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5",    provider: "anthropic", tier: "premium" },  // $3.00 / $15.00
  { id: "claude-haiku-4-5",        label: "Claude Haiku 4.5",        provider: "anthropic", tier: "value"   },  // $1.00 / $5.00  — fastest Claude
];

function detectProviderForModel(modelId: string): Provider {
  if (modelId.startsWith("gemini-")) return "gemini";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  throw new Error(`Unknown model provider for: ${modelId}`);
}

// ---------------------------------------------------------------------------
// Provider detection (global default)
// ---------------------------------------------------------------------------

function detectProvider(): Provider {
  // Log all key detection for debugging
  console.log("[llm] Key detection:");
  console.log(`  AI_INTEGRATIONS_OPENAI_API_KEY: ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "SET" : "NOT SET"}`);
  console.log(`  AI_INTEGRATIONS_OPENAI_BASE_URL: ${process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ? "SET" : "NOT SET"}`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "SET" : "NOT SET"}`);
  console.log(`  ANTHROPIC_KEY: ${process.env.ANTHROPIC_KEY ? "SET" : "NOT SET"}`);
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "SET" : "NOT SET"}`);
  console.log(`  LLM_PROVIDER: ${process.env.LLM_PROVIDER || "NOT SET"}`);

  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "openai" || forced === "anthropic" || forced === "gemini") {
    console.log(`[llm] Provider forced via LLM_PROVIDER: ${forced}`);
    return forced;
  }

  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";

  throw new Error(
    "No LLM API key configured. Set one of: AI_INTEGRATIONS_OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY."
  );
}

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

let _openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openaiClient) return _openaiClient;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Set AI_INTEGRATIONS_OPENAI_API_KEY via Replit AI Integrations."
    );
  }

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  _openaiClient = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  console.log(
    `[llm] OpenAI client initialized${baseURL ? ` (base URL: ${baseURL})` : ""}`
  );
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

const GEMINI_MODEL = "gemini-2.5-flash";

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
// Per-model generation (for Chat-to-Context model selector)
// ---------------------------------------------------------------------------

function openaiCompatibleGenerate(
  client: OpenAI,
  model: string,
  req: LLMRequest,
): Promise<LLMResponse> {
  return client.chat.completions
    .create({
      model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    })
    .then((r) => ({ text: r.choices[0]?.message?.content ?? "" }));
}

async function* openaiCompatibleStream(
  client: OpenAI,
  model: string,
  req: LLMRequest,
): AsyncGenerator<string, void, unknown> {
  const stream = await client.chat.completions.create({
    model,
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
    if (delta) yield delta;
  }
}

async function anthropicGenerateWithModel(
  model: string,
  req: LLMRequest,
): Promise<LLMResponse> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  return { text };
}

async function* anthropicStreamWithModel(
  model: string,
  req: LLMRequest,
): AsyncGenerator<string, void, unknown> {
  const client = getAnthropic();
  const stream = client.messages.stream({
    model,
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
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
// Provider dispatch (global default)
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
  /** Non-streaming generation (global provider) */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    return getGenerateFn(activeProvider)(req);
  },

  /** Streaming generation (global provider) */
  stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
    return getStreamFn(activeProvider)(req);
  },

  /** Currently active provider name */
  provider: activeProvider,

  /**
   * Direct Gemini access — backwards compat for endpoints that always use Gemini.
   */
  gemini: {
    async generate(req: LLMRequest): Promise<LLMResponse> {
      return geminiGenerate(req);
    },
    stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
      return geminiStream(req);
    },
  },

  // ── Per-model API (Chat-to-Context model selector) ──

  /** Generate with a specific model ID (routes to correct provider) */
  async generateWithModel(model: string, req: LLMRequest): Promise<LLMResponse> {
    const provider = detectProviderForModel(model);
    switch (provider) {
      case "openai":
        return openaiCompatibleGenerate(getOpenAI(), model, req);
      case "gemini":
        return openaiCompatibleGenerate(getGemini(), model, req);
      case "anthropic":
        return anthropicGenerateWithModel(model, req);
    }
  },

  /** Stream with a specific model ID (routes to correct provider) */
  streamWithModel(model: string, req: LLMRequest): AsyncGenerator<string, void, unknown> {
    const provider = detectProviderForModel(model);
    switch (provider) {
      case "openai":
        return openaiCompatibleStream(getOpenAI(), model, req);
      case "gemini":
        return openaiCompatibleStream(getGemini(), model, req);
      case "anthropic":
        return anthropicStreamWithModel(model, req);
    }
  },

  /** Returns chat models available based on configured API keys */
  getAvailableChatModels(): ChatModelDef[] {
    const hasOpenAI = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const hasAnthropic = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY);
    const hasGemini = !!process.env.GEMINI_API_KEY;
    return CHAT_MODELS.filter((m) => {
      switch (m.provider) {
        case "openai": return hasOpenAI;
        case "anthropic": return hasAnthropic;
        case "gemini": return hasGemini;
      }
    });
  },
};
