/**
 * LLM routing and utility tests for server/llm.ts
 *
 * Tests provider selection logic, model catalog, model classification,
 * and helper functions. All tests use mocks -- no real API calls.
 *
 * NOTE: The llm.ts module calls detectProvider() at import time, which
 * reads env vars. We test the pure utility functions and model routing
 * logic that can be exercised without a live provider.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Helper: we can't import llm.ts directly because it calls detectProvider()
// at module scope, which throws if no API keys are set. Instead, we test
// the exported utility functions by setting up env vars before dynamic import.
// ---------------------------------------------------------------------------

describe("LLM model utilities", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set a Gemini key so the module initializes without error
    process.env.GEMINI_API_KEY = "test-gemini-key-fake";
    // Clear other provider keys to get predictable provider selection
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    delete process.env.LLM_PROVIDER;

    // Suppress console logs from provider detection
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    // Reset module cache so each test gets fresh state
    vi.resetModules();
  });

  it("selects gemini when only GEMINI_API_KEY is set", async () => {
    const { llm } = await import("../../../server/llm");
    expect(llm.provider).toBe("gemini");
  });

  it("getAvailableChatModels returns array", async () => {
    const { getChatModels } = await import("../../../server/llm");
    const models = getChatModels();
    expect(Array.isArray(models)).toBe(true);
  });

  it("static fallback models have correct structure", async () => {
    const { getChatModels } = await import("../../../server/llm");
    const models = getChatModels();
    for (const model of models) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("label");
      expect(model).toHaveProperty("provider");
      expect(model).toHaveProperty("tier");
      expect(["premium", "value"]).toContain(model.tier);
    }
  });

  it("getDefaultModel returns a string for gemini provider", async () => {
    const { llm } = await import("../../../server/llm");
    const defaultModel = llm.getDefaultModel();
    expect(typeof defaultModel).toBe("string");
    expect(defaultModel.length).toBeGreaterThan(0);
  });
});

describe("LLM provider detection via LLM_PROVIDER env", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("forces gemini when LLM_PROVIDER=gemini (even without key)", async () => {
    process.env.LLM_PROVIDER = "gemini";
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    // Note: it will force gemini but gemini calls will fail without key
    // The provider detection itself should succeed
    const { llm } = await import("../../../server/llm");
    expect(llm.provider).toBe("gemini");
  });
});

describe("LLM request/response types", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key-fake";
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    delete process.env.LLM_PROVIDER;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("llm object has expected methods", async () => {
    const { llm } = await import("../../../server/llm");
    expect(typeof llm.generate).toBe("function");
    expect(typeof llm.stream).toBe("function");
    expect(typeof llm.generateWithModel).toBe("function");
    expect(typeof llm.streamWithModel).toBe("function");
    expect(typeof llm.getAvailableChatModels).toBe("function");
    expect(typeof llm.getDefaultModel).toBe("function");
  });

  it("llm.gemini sub-object has generate and stream", async () => {
    const { llm } = await import("../../../server/llm");
    expect(typeof llm.gemini.generate).toBe("function");
    expect(typeof llm.gemini.stream).toBe("function");
  });

  it("llm.search sub-object has query", async () => {
    const { llm } = await import("../../../server/llm");
    expect(typeof llm.search.query).toBe("function");
  });
});

describe("LLM model detection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key-fake";
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    delete process.env.LLM_PROVIDER;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("generateWithModel throws for unknown model prefix", async () => {
    const { llm } = await import("../../../server/llm");
    await expect(
      llm.generateWithModel("unknown-model", {
        system: "test",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
      })
    ).rejects.toThrow("Unknown model provider");
  });

  it("streamWithModel throws for unknown model prefix", async () => {
    const { llm } = await import("../../../server/llm");
    expect(() =>
      llm.streamWithModel("unknown-model", {
        system: "test",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 100,
      })
    ).toThrow("Unknown model provider");
  });
});

describe("LLM provider priority", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("selects openai when AI_INTEGRATIONS_OPENAI_API_KEY is set (priority 1)", async () => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "test-openai-key";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    delete process.env.LLM_PROVIDER;
    const { llm } = await import("../../../server/llm");
    expect(llm.provider).toBe("openai");
  });

  it("throws when no API keys are set", async () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.LLM_PROVIDER;

    await expect(import("../../../server/llm")).rejects.toThrow("No LLM API key configured");
  });
});
