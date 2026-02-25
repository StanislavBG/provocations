/**
 * LLM Verbose Mode — types and utilities for displaying LLM call metadata.
 *
 * When verbose mode is enabled, every API response that triggers LLM calls
 * includes a `_verbose` array with metadata for each call made.
 */

export interface LlmVerboseEntry {
  callId: string;
  provider: string;
  model: string;
  taskType: string;
  endpoint: string;
  appType?: string;
  // Parameters
  maxTokens: number;
  temperature: number;
  // Content metrics
  systemPromptCharacters: number;
  userMessageCharacters: number;
  totalContextCharacters: number;
  contextTokensEstimate: number;
  // Response metrics
  responseCharacters: number;
  responseTokensEstimate: number;
  // Cost
  estimatedCostMicrodollars: number;
  estimatedCostDisplay: string;
  // Timing
  durationMs: number;
  // Streaming flag
  streaming: boolean;
  // System prompt preview
  systemPromptPreview: string;
  // Message count
  messageCount: number;
}

/** Extract verbose metadata from any API response */
export function extractVerbose(data: unknown): LlmVerboseEntry[] | null {
  if (data && typeof data === "object" && "_verbose" in data) {
    const verbose = (data as any)._verbose;
    if (Array.isArray(verbose) && verbose.length > 0) {
      return verbose;
    }
  }
  return null;
}

/** Format token count for display */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return String(tokens);
}

/** Format cost in microdollars for display */
export function formatCost(microdollars: number): string {
  const dollars = microdollars / 1_000_000;
  if (dollars < 0.001) return `$${dollars.toFixed(6)}`;
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  return `$${dollars.toFixed(3)}`;
}

/** Format duration for display */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Get a color for the provider */
export function getProviderColor(provider: string): string {
  switch (provider) {
    case "openai": return "text-green-500";
    case "anthropic": return "text-orange-500";
    case "gemini": return "text-blue-500";
    default: return "text-gray-500";
  }
}

/** Sum up total cost across multiple verbose entries */
export function totalCost(entries: LlmVerboseEntry[]): number {
  return entries.reduce((sum, e) => sum + e.estimatedCostMicrodollars, 0);
}

/** Sum up total duration across multiple verbose entries */
export function totalDuration(entries: LlmVerboseEntry[]): number {
  return entries.reduce((sum, e) => sum + e.durationMs, 0);
}
