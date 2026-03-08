/**
 * Mock LLM response helpers for testing.
 *
 * Provides utilities to mock LLM gateway responses
 * so tests never make real API calls.
 */

import type { LLMResponse, LLMRequest } from "../../server/llm";

/**
 * Create a mock LLM response with the given content.
 */
export function mockLlmResponse(content: string): LLMResponse {
  return { text: content };
}

/**
 * Create a mock async generator that yields chunks for streaming tests.
 */
export async function* mockLlmStream(
  chunks: string[]
): AsyncGenerator<string, void, unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Create a mock LLM request for testing.
 */
export function createMockLlmRequest(overrides?: Partial<LLMRequest>): LLMRequest {
  return {
    system: "You are a helpful assistant.",
    messages: [{ role: "user", content: "Hello" }],
    maxTokens: 1000,
    temperature: 0.7,
    ...overrides,
  };
}

/**
 * Create a mock generate function that returns a predetermined response.
 * Useful for vi.fn() mocking.
 */
export function createMockGenerateFn(response: string) {
  return async (_req: LLMRequest): Promise<LLMResponse> => {
    return { text: response };
  };
}

/**
 * Create a mock stream function that yields predetermined chunks.
 */
export function createMockStreamFn(chunks: string[]) {
  return function* (_req: LLMRequest): AsyncGenerator<string, void, unknown> {
    return mockLlmStream(chunks);
  };
}

/**
 * Create a mock generate function that throws an error.
 * Useful for testing error handling paths.
 */
export function createMockErrorFn(errorMessage: string) {
  return async (_req: LLMRequest): Promise<LLMResponse> => {
    throw new Error(errorMessage);
  };
}

/**
 * A collection of canned LLM responses for common test scenarios.
 */
export const CANNED_RESPONSES = {
  challenge: JSON.stringify([
    {
      id: "ch-1",
      persona: { id: "architect", label: "Architect" },
      title: "Missing error handling strategy",
      content: "Your document does not address how errors propagate through the system.",
      sourceExcerpt: "The API accepts all inputs...",
      status: "pending",
      scale: 4,
    },
  ]),

  advice:
    "Consider implementing a centralized error boundary pattern with typed error codes and fallback strategies for each service layer.",

  write: JSON.stringify({
    document: "# Updated Document\n\nThe revised content here.",
    summary: "Added error handling section",
    instructionType: "expand",
    changes: [{ type: "added", description: "Error handling section" }],
  }),

  interviewQuestion: JSON.stringify({
    question: "What happens when a user loses connectivity mid-session?",
    topic: "Error Handling",
    reasoning: "The document mentions real-time features but doesn't address offline scenarios.",
  }),
} as const;
