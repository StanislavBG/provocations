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
 *   const stream = llm.streamWithModel("gpt-5-mini", req);
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
  /** Enable Google Search grounding (Gemini only). When true, Gemini uses
   *  live internet search to ground its responses with real-time data. */
  enableSearch?: boolean;
}

export interface LLMResponse {
  text: string;
}

// ---------------------------------------------------------------------------
// Chat model catalog — discovered from live APIs at startup
// ---------------------------------------------------------------------------

type Provider = "openai" | "anthropic" | "gemini";

export interface ChatModelDef {
  id: string;
  label: string;
  provider: Provider;
  tier: "premium" | "value";
}

/**
 * Model prefixes we care about, in preference order (best first).
 * Only models matching these prefixes will be included in the catalog.
 * The first match in each provider determines the default model for that provider.
 */
const OPENAI_PREFERRED_PREFIXES = [
  // GPT-5 series
  "gpt-5",
  // GPT-4 series (fallback)
  "gpt-4o", "gpt-4-turbo", "gpt-4",
  // Reasoning models
  "o4", "o3", "o1",
];

const GEMINI_PREFERRED_PREFIXES = [
  "gemini-2.5", "gemini-2.0", "gemini-1.5",
];

/** Models to skip even if they match a prefix (snapshots, dated variants, etc.) */
const MODEL_SKIP_PATTERNS = [
  /realtime/i,    // realtime audio models
  /audio/i,       // audio models
  /search/i,      // search-grounded variants
  /\d{4}-\d{2}-\d{2}$/,  // dated snapshot IDs (e.g. gpt-4o-2024-08-06) — keep only aliases
];

/** Mutable catalog — populated by discoverModels() at startup, with static fallback */
let discoveredModels: ChatModelDef[] = [];
let modelsDiscovered = false;

/** The default OpenAI model — updated after discovery */
let openaiDefaultModel = "gpt-4o";

function modelIdToLabel(id: string): string {
  return id
    .replace(/^models\//, "")
    .split(/[-.]/)
    .map((w) => {
      // Uppercase known acronyms
      if (/^gpt$/i.test(w)) return "GPT";
      if (/^o\d+$/i.test(w)) return w.toUpperCase();
      // Capitalize first letter
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/ (\d)/g, "-$1")  // "GPT 5" → "GPT-5"
    .replace(/(\d) (\d)/g, "$1.$2");  // "5 2" → "5.2" for version dots
}

function classifyTier(id: string): "premium" | "value" {
  if (/mini|nano|lite|flash/i.test(id)) return "value";
  return "premium";
}

function matchesPrefixes(id: string, prefixes: string[]): boolean {
  return prefixes.some((p) => id.startsWith(p));
}

function shouldSkip(id: string): boolean {
  return MODEL_SKIP_PATTERNS.some((p) => p.test(id));
}

/**
 * Discover live models from OpenAI and Gemini APIs.
 * Called once at server startup. Falls back to static catalog on error.
 */
export async function discoverModels(): Promise<void> {
  const results: ChatModelDef[] = [];

  // ── OpenAI models ──
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    try {
      const client = getOpenAI();
      const list = await client.models.list();
      const openaiModels: string[] = [];
      for await (const model of list) {
        openaiModels.push(model.id);
      }

      const filtered = openaiModels
        .filter((id) => matchesPrefixes(id, OPENAI_PREFERRED_PREFIXES))
        .filter((id) => !shouldSkip(id))
        .sort();

      for (const id of filtered) {
        results.push({
          id,
          label: modelIdToLabel(id),
          provider: "openai",
          tier: classifyTier(id),
        });
      }

      // Pick the best default: first match in preference order
      for (const prefix of OPENAI_PREFERRED_PREFIXES) {
        const best = filtered.find((id) => id.startsWith(prefix) && classifyTier(id) === "premium");
        if (best) {
          openaiDefaultModel = best;
          break;
        }
      }

      console.log(`[llm] Discovered ${filtered.length} OpenAI models. Default: ${openaiDefaultModel}`);
    } catch (err) {
      console.warn("[llm] Failed to discover OpenAI models, using static fallback:", (err as Error).message);
      results.push(
        { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "premium" },
        { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", tier: "value" },
      );
    }
  }

  // ── Gemini models ──
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=200`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };

      const geminiModels = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((id) => matchesPrefixes(id, GEMINI_PREFERRED_PREFIXES))
        .filter((id) => !shouldSkip(id))
        .sort();

      for (const id of geminiModels) {
        results.push({
          id,
          label: modelIdToLabel(id),
          provider: "gemini",
          tier: classifyTier(id),
        });
      }

      console.log(`[llm] Discovered ${geminiModels.length} Gemini models.`);
    } catch (err) {
      console.warn("[llm] Failed to discover Gemini models, using static fallback:", (err as Error).message);
      results.push(
        { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tier: "value" },
      );
    }
  }

  // ── Anthropic models (static — no list API in SDK) ──
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY) {
    results.push(
      { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", tier: "premium" },
      { id: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5", provider: "anthropic", tier: "value" },
    );
  }

  if (results.length > 0) {
    discoveredModels = results;
    modelsDiscovered = true;
  }
}

/** Static fallback used before discovery completes or if discovery fails entirely */
const STATIC_FALLBACK_MODELS: ChatModelDef[] = [
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "premium" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", tier: "value" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tier: "value" },
];

export function getChatModels(): ChatModelDef[] {
  return modelsDiscovered ? discoveredModels : STATIC_FALLBACK_MODELS;
}

export function getDefaultOpenAIModel(): string {
  return openaiDefaultModel;
}

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

async function openaiGenerate(req: LLMRequest): Promise<LLMResponse> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: getDefaultOpenAIModel(),
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
    model: getDefaultOpenAIModel(),
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
// Gemini client (native REST API — direct to generativelanguage.googleapis.com)
// ---------------------------------------------------------------------------

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Set GEMINI_API_KEY.");
  }
  return apiKey;
}

/** Convert LLMRequest messages to Gemini native contents format */
function toGeminiContents(messages: LLMMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

/** Build the native Gemini request body */
function buildGeminiBody(req: LLMRequest, enableSearch = false): Record<string, unknown> {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: toGeminiContents(req.messages),
    generationConfig: {
      maxOutputTokens: req.maxTokens,
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
    },
  };
  if (enableSearch) {
    body.tools = [{ googleSearch: {} }];
  }
  return body;
}

async function geminiNativeGenerate(
  model: string,
  req: LLMRequest,
  enableSearch = false,
): Promise<LLMResponse> {
  const apiKey = getGeminiApiKey();
  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiBody(req, enableSearch)),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini generate failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  return { text };
}

async function* geminiNativeStream(
  model: string,
  req: LLMRequest,
  enableSearch = false,
): AsyncGenerator<string, void, unknown> {
  const apiKey = getGeminiApiKey();
  const response = await fetch(
    `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiBody(req, enableSearch)),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini stream failed: ${response.status} - ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body from Gemini stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines: each chunk is "data: {...}\n\n"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === "[DONE]") return;

      try {
        const chunk = JSON.parse(jsonStr);
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text) yield part.text;
          }
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

/** Default-model wrappers for global provider dispatch */
async function geminiGenerate(req: LLMRequest): Promise<LLMResponse> {
  return geminiNativeGenerate(GEMINI_MODEL, req, req.enableSearch);
}

function geminiStream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
  return geminiNativeStream(GEMINI_MODEL, req, req.enableSearch);
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
// Gemini Search with Google Search grounding
// ---------------------------------------------------------------------------

export interface SearchResult {
  answer: string;
  sources: Array<{ title: string; url: string; snippet: string }>;
}

async function geminiSearchWithGrounding(query: string): Promise<SearchResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured for search. Set GEMINI_API_KEY.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini search failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as any;
  const candidate = data.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p: any) => p.text).join("") || "No results found.";

  const groundingMetadata = candidate?.groundingMetadata;
  const sources: Array<{ title: string; url: string; snippet: string }> = [];

  if (groundingMetadata?.groundingChunks) {
    for (const chunk of groundingMetadata.groundingChunks) {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Untitled",
          url: chunk.web.uri || "",
          snippet: "",
        });
      }
    }
  }

  return { answer, sources };
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
        return geminiNativeGenerate(model, req, req.enableSearch);
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
        return geminiNativeStream(model, req, req.enableSearch);
      case "anthropic":
        return anthropicStreamWithModel(model, req);
    }
  },

  /** Returns chat models discovered from live APIs (filtered by configured keys) */
  getAvailableChatModels(): ChatModelDef[] {
    return getChatModels();
  },

  /** Default model ID for the active provider */
  getDefaultModel(): string {
    switch (activeProvider) {
      case "openai": return getDefaultOpenAIModel();
      case "gemini": {
        const geminiModels = getChatModels().filter((m) => m.provider === "gemini");
        return geminiModels[0]?.id ?? "gemini-2.5-flash";
      }
      case "anthropic": return ANTHROPIC_MODEL;
    }
  },

  /** Live internet search via Gemini with Google Search grounding */
  search: {
    async query(query: string): Promise<SearchResult> {
      return geminiSearchWithGrounding(query);
    },
  },
};
