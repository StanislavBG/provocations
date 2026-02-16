/**
 * Configurable LLM provider abstraction.
 *
 * Supports:
 *   - Google Gemini (default when GEMINI_API_KEY is set)
 *   - Anthropic Claude (when ANTHROPIC_API_KEY / ANTHROPIC_KEY is set)
 *
 * Set LLM_PROVIDER=anthropic to force Anthropic even when both keys are present.
 * Defaults to "gemini" when GEMINI_API_KEY is available.
 *
 * Usage:
 *   const result = await llm.generate({ system, messages, maxTokens, temperature });
 *   const stream = llm.stream({ system, messages, maxTokens });
 */

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

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

export type LLMProvider = "gemini" | "anthropic";

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

function detectProvider(): LLMProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "gemini") return "gemini";

  // Auto-detect: prefer Gemini if key is available
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY) return "anthropic";

  throw new Error(
    "No LLM provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY as a secret."
  );
}

// ---------------------------------------------------------------------------
// Gemini implementation
// ---------------------------------------------------------------------------

let _geminiClient: GoogleGenerativeAI | null = null;
let _geminiKey: string | undefined;

function getGemini(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  if (!_geminiClient || key !== _geminiKey) {
    _geminiKey = key;
    _geminiClient = new GoogleGenerativeAI(key);
  }
  return _geminiClient;
}

// Map from our generic model hint to Gemini model IDs
function geminiModel(maxTokens: number): string {
  // Use Gemini 2.0 Flash for everything — fast, cheap, capable
  // For very large contexts or outputs, use the thinking model variant
  if (maxTokens > 4096) return "gemini-2.0-flash";
  return "gemini-2.0-flash";
}

async function geminiGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getGemini();
  const modelId = geminiModel(req.maxTokens);
  const model: GenerativeModel = client.getGenerativeModel({
    model: modelId,
    systemInstruction: req.system,
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
    },
  });

  // Build conversation history for multi-turn
  const history = req.messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const lastMessage = req.messages[req.messages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);
  const text = result.response.text();

  return { text };
}

async function* geminiStream(
  req: LLMRequest
): AsyncGenerator<string, void, unknown> {
  const client = getGemini();
  const modelId = geminiModel(req.maxTokens);
  const model: GenerativeModel = client.getGenerativeModel({
    model: modelId,
    systemInstruction: req.system,
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      temperature: req.temperature,
    },
  });

  const history = req.messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const lastMessage = req.messages[req.messages.length - 1];

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

// ---------------------------------------------------------------------------
// Anthropic implementation
// ---------------------------------------------------------------------------

async function anthropicGenerate(req: LLMRequest): Promise<LLMResponse> {
  // Dynamic import so the app doesn't crash if @anthropic-ai/sdk isn't installed
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const key = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: req.maxTokens,
    temperature: req.temperature,
    system: req.system,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return { text };
}

async function* anthropicStream(
  req: LLMRequest
): AsyncGenerator<string, void, unknown> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const key = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");

  const client = new Anthropic({ apiKey: key });
  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
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
  /** Which provider is active */
  get provider(): LLMProvider {
    return detectProvider();
  },

  /** Non-streaming generation */
  async generate(req: LLMRequest): Promise<LLMResponse> {
    const provider = detectProvider();
    if (provider === "gemini") return geminiGenerate(req);
    return anthropicGenerate(req);
  },

  /** Streaming generation — yields text chunks */
  stream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
    const provider = detectProvider();
    if (provider === "gemini") return geminiStream(req);
    return anthropicStream(req);
  },
};
