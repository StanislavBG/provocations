/**
 * LLM Gateway — unified wrapper around all LLM calls.
 *
 * Every LLM interaction in the application goes through this gateway.
 * It provides:
 *   1. Logging — records metadata for every call (no user text)
 *   2. Verbose metadata — returns context plan details when verbose mode is on
 *   3. Cost estimation — per-call cost in microdollars
 *   4. Timing — duration of each call
 *
 * The gateway does NOT store any user-provided text. It only logs:
 *   - Who called (userId), what app, what task type, which endpoint
 *   - Model + provider, token estimates, character counts, cost, duration
 */

import { randomUUID } from "crypto";
import { llm, type LLMRequest, type LLMResponse } from "./llm";
import { storage } from "./storage";

// ---------------------------------------------------------------------------
// Cost table — per-million-token pricing (input / output) in microdollars
// $1 = 1,000,000 microdollars. Prices per 1M tokens.
// ---------------------------------------------------------------------------

const COST_TABLE: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o":             { input: 2_500_000, output: 10_000_000 },  // $2.50 / $10.00
  "gpt-4o-mini":        { input: 150_000,   output: 600_000 },     // $0.15 / $0.60
  "o4-mini":            { input: 1_100_000, output: 4_400_000 },   // $1.10 / $4.40
  // Anthropic
  "claude-sonnet-4-5-20250929": { input: 3_000_000, output: 15_000_000 }, // $3.00 / $15.00
  "claude-haiku-4-5":   { input: 1_000_000, output: 5_000_000 },   // $1.00 / $5.00
  // Gemini
  "gemini-2.5-pro":     { input: 1_250_000, output: 10_000_000 },  // $1.25 / $10.00
  "gemini-2.5-flash":   { input: 150_000,   output: 625_000 },     // $0.15 / $0.625
  "gemini-2.5-flash-lite": { input: 75_000, output: 300_000 },     // $0.075 / $0.30
};

// Rough chars-per-token ratio for estimation (varies by language/model)
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_TABLE[model];
  if (!pricing) return 0;
  // Cost = (tokens / 1M) * price_per_1M
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round(inputCost + outputCost);
}

// ---------------------------------------------------------------------------
// Gateway call context — passed by the route handler
// ---------------------------------------------------------------------------

export interface GatewayContext {
  userId: string;
  sessionId?: string;
  appType?: string;
  taskType: string;
  endpoint: string;
}

// ---------------------------------------------------------------------------
// Verbose metadata — returned to the frontend when verbose mode is on
// ---------------------------------------------------------------------------

export interface LlmVerboseMetadata {
  callId: string;
  provider: string;
  model: string;
  taskType: string;
  endpoint: string;
  appType?: string;
  // Parameters
  maxTokens: number;
  temperature: number;
  // Content metrics (character counts, not the content itself)
  systemPromptCharacters: number;
  userMessageCharacters: number;
  totalContextCharacters: number;
  contextTokensEstimate: number;
  // Response metrics
  responseCharacters: number;
  responseTokensEstimate: number;
  // Cost
  estimatedCostMicrodollars: number;
  estimatedCostDisplay: string; // human-readable e.g. "$0.0032"
  // Timing
  durationMs: number;
  // Streaming flag
  streaming: boolean;
  // System prompt preview (first 200 chars for verbose display)
  systemPromptPreview: string;
  // Message count
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Original function references — captured before interceptor overwrites them.
// These are used by gatewayGenerate/gatewayStream to avoid infinite recursion.
// ---------------------------------------------------------------------------

const _origGenerate = llm.generate.bind(llm);
const _origStream = llm.stream.bind(llm);
const _origGenerateWithModel = llm.generateWithModel.bind(llm);
const _origStreamWithModel = llm.streamWithModel.bind(llm);

// ---------------------------------------------------------------------------
// Gateway generate — wraps llm.generate with logging + verbose metadata
// ---------------------------------------------------------------------------

export async function gatewayGenerate(
  req: LLMRequest,
  ctx: GatewayContext,
  opts?: { model?: string },
): Promise<LLMResponse & { _verbose?: LlmVerboseMetadata }> {
  const callId = randomUUID();
  const model = opts?.model || getDefaultModel();
  const provider = getProviderForModel(model);
  const startTime = Date.now();

  // Compute input metrics
  const systemChars = req.system.length;
  const userChars = req.messages.reduce((sum, m) => sum + m.content.length, 0);
  const totalInputChars = systemChars + userChars;
  const inputTokens = estimateTokens(req.system + req.messages.map(m => m.content).join(""));

  let response: LLMResponse | undefined;
  let status: "success" | "error" = "success";
  let errorMessage: string | undefined;

  try {
    // Use original (non-intercepted) functions to avoid recursion
    if (opts?.model) {
      response = await _origGenerateWithModel(opts.model, req);
    } else {
      response = await _origGenerate(req);
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const durationMs = Date.now() - startTime;
    const responseChars = status === "success" ? (response?.text?.length ?? 0) : 0;
    const outputTokens = estimateTokens(response?.text ?? "");
    const costMicro = estimateCost(model, inputTokens, outputTokens);

    // Log asynchronously — don't block the response
    storage.insertLlmCallLog({
      callId,
      userId: ctx.userId,
      sessionId: ctx.sessionId ?? null,
      appType: ctx.appType ?? null,
      taskType: ctx.taskType,
      endpoint: ctx.endpoint,
      provider,
      model,
      contextTokensEstimate: inputTokens,
      contextCharacters: totalInputChars,
      responseCharacters: responseChars,
      responseTokensEstimate: outputTokens,
      maxTokens: req.maxTokens,
      temperature: req.temperature != null ? Math.round(req.temperature * 100) : null,
      estimatedCostMicrodollars: costMicro,
      durationMs,
      status,
      errorMessage: errorMessage ?? null,
      streaming: false,
    }).catch((logErr) => {
      console.error("[llm-gateway] Failed to insert call log:", logErr instanceof Error ? logErr.message : logErr);
    });
  }

  // Build verbose metadata (only reached on success — error re-throws above)
  const finalDurationMs = Date.now() - startTime;
  const finalResponseChars = response!.text.length;
  const finalOutputTokens = estimateTokens(response!.text);
  const finalCost = estimateCost(model, inputTokens, finalOutputTokens);

  const verbose: LlmVerboseMetadata = {
    callId,
    provider,
    model,
    taskType: ctx.taskType,
    endpoint: ctx.endpoint,
    appType: ctx.appType,
    maxTokens: req.maxTokens,
    temperature: req.temperature ?? 1.0,
    systemPromptCharacters: systemChars,
    userMessageCharacters: userChars,
    totalContextCharacters: totalInputChars,
    contextTokensEstimate: inputTokens,
    responseCharacters: finalResponseChars,
    responseTokensEstimate: finalOutputTokens,
    estimatedCostMicrodollars: finalCost,
    estimatedCostDisplay: `$${(finalCost / 1_000_000).toFixed(6)}`,
    durationMs: finalDurationMs,
    streaming: false,
    systemPromptPreview: req.system.slice(0, 300),
    messageCount: req.messages.length,
  };

  return { ...response!, _verbose: verbose };
}

// ---------------------------------------------------------------------------
// Gateway stream — wraps llm.stream with logging + verbose metadata
// Returns an async generator that yields chunks, plus a promise for metadata
// ---------------------------------------------------------------------------

export interface GatewayStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  getVerboseMetadata: () => LlmVerboseMetadata | null;
}

export function gatewayStream(
  req: LLMRequest,
  ctx: GatewayContext,
  opts?: { model?: string },
): GatewayStreamResult {
  const callId = randomUUID();
  const model = opts?.model || getDefaultModel();
  const provider = getProviderForModel(model);
  const startTime = Date.now();

  // Compute input metrics
  const systemChars = req.system.length;
  const userChars = req.messages.reduce((sum, m) => sum + m.content.length, 0);
  const totalInputChars = systemChars + userChars;
  const inputTokens = estimateTokens(req.system + req.messages.map(m => m.content).join(""));

  let verboseMetadata: LlmVerboseMetadata | null = null;

  async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
    let totalResponseChars = 0;
    let status: "success" | "error" = "success";
    let errorMessage: string | undefined;

    try {
      // Use original (non-intercepted) functions to avoid recursion
      const rawStream = opts?.model
        ? _origStreamWithModel(opts.model, req)
        : _origStream(req);

      for await (const chunk of rawStream) {
        totalResponseChars += chunk.length;
        yield chunk;
      }
    } catch (err) {
      status = "error";
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      const outputTokens = estimateTokens("x".repeat(totalResponseChars));
      const costMicro = estimateCost(model, inputTokens, outputTokens);

      verboseMetadata = {
        callId,
        provider,
        model,
        taskType: ctx.taskType,
        endpoint: ctx.endpoint,
        appType: ctx.appType,
        maxTokens: req.maxTokens,
        temperature: req.temperature ?? 1.0,
        systemPromptCharacters: systemChars,
        userMessageCharacters: userChars,
        totalContextCharacters: totalInputChars,
        contextTokensEstimate: inputTokens,
        responseCharacters: totalResponseChars,
        responseTokensEstimate: outputTokens,
        estimatedCostMicrodollars: costMicro,
        estimatedCostDisplay: `$${(costMicro / 1_000_000).toFixed(6)}`,
        durationMs,
        streaming: true,
        systemPromptPreview: req.system.slice(0, 300),
        messageCount: req.messages.length,
      };

      // Log
      storage.insertLlmCallLog({
        callId,
        userId: ctx.userId,
        sessionId: ctx.sessionId ?? null,
        appType: ctx.appType ?? null,
        taskType: ctx.taskType,
        endpoint: ctx.endpoint,
        provider,
        model,
        contextTokensEstimate: inputTokens,
        contextCharacters: totalInputChars,
        responseCharacters: totalResponseChars,
        responseTokensEstimate: outputTokens,
        maxTokens: req.maxTokens,
        temperature: req.temperature != null ? Math.round(req.temperature * 100) : null,
        estimatedCostMicrodollars: costMicro,
        durationMs,
        status,
        errorMessage: errorMessage ?? null,
        streaming: true,
      }).catch((logErr) => {
        console.error("[llm-gateway] Failed to insert stream call log:", logErr instanceof Error ? logErr.message : logErr);
      });
    }
  }

  return {
    stream: wrappedStream(),
    getVerboseMetadata: () => verboseMetadata,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultModel(): string {
  switch (llm.provider) {
    case "openai": return "gpt-4o";
    case "anthropic": return "claude-sonnet-4-5-20250929";
    case "gemini": return "gemini-2.5-flash";
  }
}

function getProviderForModel(model: string): string {
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) return "openai";
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gemini-")) return "gemini";
  return llm.provider;
}

// ---------------------------------------------------------------------------
// Verbose mode check — returns true if the user has verbose mode enabled
// ---------------------------------------------------------------------------

export async function isVerboseEnabled(userId: string): Promise<boolean> {
  try {
    const prefs = await storage.getUserPreferences(userId);
    return prefs.verboseMode;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Request-scoped interceptor — automatically logs all llm calls in a request
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";

interface RequestGatewayScope {
  ctx: GatewayContext;
  verboseList: LlmVerboseMetadata[];
}

const gatewayScope = new AsyncLocalStorage<RequestGatewayScope>();

/**
 * Run a function within a gateway scope. All llm.generate/stream calls
 * made within this scope will be automatically intercepted and logged.
 *
 * After the function completes, `scope.verboseList` contains metadata
 * for every LLM call made during the request.
 */
export function runWithGateway<T>(
  ctx: GatewayContext,
  fn: () => T | Promise<T>,
): Promise<{ result: T; verboseList: LlmVerboseMetadata[] }> {
  const scope: RequestGatewayScope = { ctx, verboseList: [] };
  return gatewayScope.run(scope, async () => {
    const result = await fn();
    return { result, verboseList: scope.verboseList };
  });
}

/** Get the current request's gateway scope (if inside runWithGateway) */
export function getActiveScope(): RequestGatewayScope | undefined {
  return gatewayScope.getStore();
}

// ---------------------------------------------------------------------------
// Intercept llm.generate and llm.stream at the module level
// ---------------------------------------------------------------------------

llm.generate = async function interceptedGenerate(req: LLMRequest): Promise<LLMResponse> {
  const scope = gatewayScope.getStore();
  if (!scope) return _origGenerate(req);

  const result = await gatewayGenerate(req, scope.ctx);
  if (result._verbose) scope.verboseList.push(result._verbose);
  return { text: result.text };
};

llm.stream = function interceptedStream(req: LLMRequest): AsyncGenerator<string, void, unknown> {
  const scope = gatewayScope.getStore();
  if (!scope) return _origStream(req);

  const capturedScope = scope;
  const { stream, getVerboseMetadata } = gatewayStream(req, capturedScope.ctx);

  // Wrap to capture verbose metadata after stream completes
  async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
    yield* stream;
    const meta = getVerboseMetadata();
    if (meta) capturedScope.verboseList.push(meta);
  }

  return wrappedStream();
};

llm.generateWithModel = async function interceptedGenerateWithModel(
  model: string,
  req: LLMRequest,
): Promise<LLMResponse> {
  const scope = gatewayScope.getStore();
  if (!scope) return _origGenerateWithModel(model, req);

  const result = await gatewayGenerate(req, scope.ctx, { model });
  if (result._verbose) scope.verboseList.push(result._verbose);
  return { text: result.text };
};

llm.streamWithModel = function interceptedStreamWithModel(
  model: string,
  req: LLMRequest,
): AsyncGenerator<string, void, unknown> {
  const scope = gatewayScope.getStore();
  if (!scope) return _origStreamWithModel(model, req);

  const capturedScope = scope;
  const { stream, getVerboseMetadata } = gatewayStream(req, capturedScope.ctx, { model });

  async function* wrappedStream(): AsyncGenerator<string, void, unknown> {
    yield* stream;
    const meta = getVerboseMetadata();
    if (meta) capturedScope.verboseList.push(meta);
  }

  return wrappedStream();
};
